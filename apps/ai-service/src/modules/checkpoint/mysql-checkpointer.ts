import { Logger } from '@nestjs/common';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import type { RunnableConfig } from '@langchain/core/runnables';
import * as mysql from 'mysql2/promise';

/** 与 Python 版 PostgresSaver 对齐的三张表 */
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS checkpoints (
     thread_id VARCHAR(64) NOT NULL,
     checkpoint_ns VARCHAR(64) NOT NULL DEFAULT '',
     checkpoint_id VARCHAR(64) NOT NULL,
     parent_checkpoint_id VARCHAR(64) NULL,
     type VARCHAR(32) NULL,
     checkpoint LONGTEXT NOT NULL,
     metadata LONGTEXT NOT NULL,
     PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS checkpoint_blobs (
     thread_id VARCHAR(64) NOT NULL,
     checkpoint_ns VARCHAR(64) NOT NULL DEFAULT '',
     channel VARCHAR(128) NOT NULL,
     version VARCHAR(64) NOT NULL,
     type VARCHAR(32) NOT NULL,
     blob LONGTEXT NULL,
     PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS checkpoint_writes (
     thread_id VARCHAR(64) NOT NULL,
     checkpoint_ns VARCHAR(64) NOT NULL DEFAULT '',
     checkpoint_id VARCHAR(64) NOT NULL,
     task_id VARCHAR(64) NOT NULL,
     idx INT NOT NULL,
     channel VARCHAR(128) NOT NULL,
     type VARCHAR(32) NOT NULL,
     blob LONGTEXT NOT NULL,
     PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export interface MysqlSaverOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * LangGraph Checkpoint 的 MySQL 实现
 *
 * 会话状态（messages 全量上下文、Agent 中间步骤、pending writes）都落在 InnoDB 表里，
 * 因此服务重启后仍可续聊，且支持按 thread_id 做「时光回溯」。
 */
export class MysqlSaver extends BaseCheckpointSaver {
  private readonly logger = new Logger(MysqlSaver.name);
  private pool!: mysql.Pool;

  constructor(private readonly options: MysqlSaverOptions) {
    super();
  }

  async init(): Promise<void> {
    this.pool = mysql.createPool({
      ...this.options,
      waitForConnections: true,
      connectionLimit: 8,
      charset: 'utf8mb4',
    });
    for (const sql of CREATE_TABLES) {
      await this.pool.query(sql);
    }
    this.logger.log(`Checkpoint 存储已就绪（${this.options.host}:${this.options.port}/${this.options.database}）`);
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }

  /* ------------------------- 序列化 ------------------------- */

  private async dumps(obj: unknown): Promise<{ type: string; blob: string }> {
    const serde: any = (this as any).serde;
    if (serde?.dumpsTyped) {
      const [type, bytes] = await serde.dumpsTyped(obj);
      return { type, blob: Buffer.from(bytes).toString('base64') };
    }
    return { type: 'json', blob: JSON.stringify(obj) };
  }

  private async loads(type: string | null, blob: string | null): Promise<any> {
    if (blob === null || blob === undefined) return undefined;
    const serde: any = (this as any).serde;
    if (serde?.loadsTyped && type && type !== 'json') {
      try {
        return await serde.loadsTyped(type, Buffer.from(blob, 'base64'));
      } catch {
        /* 回退到纯 JSON */
      }
    }
    try {
      return JSON.parse(blob);
    } catch {
      return null;
    }
  }

  /* ------------------------- 读 ------------------------- */

  async getTuple(config: RunnableConfig): Promise<any> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;
    if (!threadId) return undefined;

    const sql = checkpointId
      ? `SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata
         FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?`
      : `SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata
         FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ?
         ORDER BY checkpoint_id DESC LIMIT 1`;

    const params = checkpointId ? [threadId, checkpointNs, checkpointId] : [threadId, checkpointNs];
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(sql, params);
    const row = rows?.[0];
    if (!row) return undefined;

    const checkpoint = await this.loads(row.type, row.checkpoint);
    const metadata = await this.loads(row.type, row.metadata);

    const [writeRows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT task_id, channel, type, blob FROM checkpoint_writes
       WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
       ORDER BY idx ASC`,
      [threadId, checkpointNs, row.checkpoint_id],
    );
    const pendingWrites: Array<[string, string, unknown]> = [];
    for (const w of writeRows) {
      pendingWrites.push([w.task_id, w.channel, await this.loads(w.type, w.blob)]);
    }

    return {
      config: {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint,
      metadata,
      parentConfig: row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined,
      pendingWrites,
    };
  }

  async *list(config: RunnableConfig, options?: any): AsyncGenerator<any> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';
    if (!threadId) return;

    const limit = options?.limit ? `LIMIT ${Number(options.limit)}` : '';
    const before = options?.before?.checkpoint_id
      ? `AND checkpoint_id < '${String(options.before.checkpoint_id).replace(/'/g, '')}'`
      : '';

    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT thread_id, checkpoint_ns, checkpoint_id FROM checkpoints
       WHERE thread_id = ? AND checkpoint_ns = ?
       ${before} ORDER BY checkpoint_id DESC ${limit}`,
      [threadId, checkpointNs],
    );

    for (const r of rows) {
      const tuple = await this.getTuple({
        configurable: {
          thread_id: r.thread_id,
          checkpoint_ns: r.checkpoint_ns,
          checkpoint_id: r.checkpoint_id,
        },
      } as RunnableConfig);
      if (tuple) yield tuple;
    }
  }

  /* ------------------------- 写 ------------------------- */

  async put(
    config: RunnableConfig,
    checkpoint: any,
    metadata: any,
    _newVersions: Record<string, string | number>,
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';
    const parentId = (config.configurable?.checkpoint_id as string) ?? null;

    const { type, blob } = await this.dumps(checkpoint);
    const meta = await this.dumps(metadata);

    await this.pool.query(
      `INSERT INTO checkpoints
         (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         parent_checkpoint_id = VALUES(parent_checkpoint_id),
         type = VALUES(type), checkpoint = VALUES(checkpoint), metadata = VALUES(metadata)`,
      [threadId, checkpointNs, checkpoint.id, parentId, type, blob, meta.blob],
    );

    await this.putBlobs(threadId, checkpointNs, checkpoint);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  /** checkpoint.channel_values + versions 拆到 blobs 表，避免单行过大 */
  private async putBlobs(threadId: string, checkpointNs: string, checkpoint: any) {
    const channelValues = checkpoint?.channel_values ?? {};
    const versions: Record<string, string | number> = checkpoint?.channel_versions ?? {};
    const newVersions: Record<string, string | number> = checkpoint?.versions_seen
      ? Object.fromEntries(
          Object.entries(checkpoint.versions_seen as Record<string, Record<string, string | number>>).flatMap(
            ([, seen]) => Object.entries(seen),
          ),
        )
      : {};

    const entries = new Set([
      ...Object.keys(channelValues),
      ...Object.keys(versions),
      ...Object.keys(newVersions),
    ]);

    for (const channel of entries) {
      const version = String(versions[channel] ?? newVersions[channel] ?? '');
      const value = channelValues[channel];
      const { type, blob } = await this.dumps(value ?? null);
      await this.pool.query(
        `INSERT INTO checkpoint_blobs (thread_id, checkpoint_ns, channel, version, type, blob)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type = VALUES(type), blob = VALUES(blob)`,
        [threadId, checkpointNs, channel, version, type, blob],
      );
    }
  }

  async putWrites(config: RunnableConfig, writes: Array<[string, unknown]>, taskId: string): Promise<void> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? '';
    const checkpointId = config.configurable?.checkpoint_id as string;
    if (!threadId || !checkpointId) return;

    for (let idx = 0; idx < writes.length; idx++) {
      const [channel, value] = writes[idx];
      const { type, blob } = await this.dumps(value);
      await this.pool.query(
        `INSERT INTO checkpoint_writes
           (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, blob)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE channel = VALUES(channel), type = VALUES(type), blob = VALUES(blob)`,
        [threadId, checkpointNs, checkpointId, taskId, idx, channel, type, blob],
      );
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await Promise.all([
      this.pool.query('DELETE FROM checkpoints WHERE thread_id = ?', [threadId]),
      this.pool.query('DELETE FROM checkpoint_blobs WHERE thread_id = ?', [threadId]),
      this.pool.query('DELETE FROM checkpoint_writes WHERE thread_id = ?', [threadId]),
    ]);
  }
}

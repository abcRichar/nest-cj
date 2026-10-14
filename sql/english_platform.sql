-- =============================================================
--  LinguaFlow 英语学习平台 · 数据库初始化脚本
--  MySQL 5.7+ / 8.0   字符集 utf8mb4
--
--  使用方式（二选一）：
--    A. 命令行：mysql -uroot -p english_platform < english_platform.sql
--    B. 面板  ：宝塔/phpMyAdmin → 选库 english_platform → 导入 → 选择本文件
--
--  注意：脚本开头会 DROP 同名表，重复执行会清空已有数据。
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- 用户
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(50)  NOT NULL COMMENT '登录名',
  `email`       VARCHAR(120) NOT NULL COMMENT '邮箱，用于接收学习日报',
  `password`    VARCHAR(120) NOT NULL COMMENT 'bcrypt 哈希',
  `nickname`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '昵称',
  `phone`       VARCHAR(128) NULL COMMENT '手机号（AES-256-CBC 密文）',
  `phoneHash`   VARCHAR(32)  NULL COMMENT '手机号 md5，密文状态下等值检索',
  `avatar`      VARCHAR(500) NULL,
  `bio`         VARCHAR(255) NULL,
  `role`        VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT 'USER / ADMIN',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE / DISABLED',
  `lastLoginAt` DATETIME     NULL,
  `createdAt`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`),
  UNIQUE KEY `uk_user_email` (`email`),
  KEY `idx_user_role_status` (`role`, `status`),
  KEY `idx_user_phone_hash` (`phoneHash`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户';

-- -------------------------------------------------------------
-- 课程分类
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `course_category`;
CREATE TABLE `course_category` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(50) NOT NULL,
  `sort`      INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '课程分类';

-- -------------------------------------------------------------
-- 课程
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `course`;
CREATE TABLE `course` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`         VARCHAR(120) NOT NULL,
  `subtitle`      VARCHAR(255) NULL,
  `cover`         VARCHAR(500) NULL,
  `description`   TEXT NULL,
  `price`         INT NOT NULL DEFAULT 0 COMMENT '售价（分）',
  `originalPrice` INT NULL COMMENT '原价（分）',
  `level`         VARCHAR(20) NOT NULL DEFAULT 'BEGINNER' COMMENT 'BEGINNER/INTERMEDIATE/ADVANCED',
  `categoryId`    INT UNSIGNED NULL,
  `teacher`       VARCHAR(50) NOT NULL DEFAULT '',
  `duration`      INT NOT NULL DEFAULT 0 COMMENT '总时长（秒）',
  `lessonCount`   INT NOT NULL DEFAULT 0,
  `studentCount`  INT NOT NULL DEFAULT 0,
  `rating`        DECIMAL(3,1) NOT NULL DEFAULT 5.0,
  `tags`          VARCHAR(500) NULL COMMENT 'JSON 数组',
  `status`        VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/OFFLINE',
  `sort`          INT NOT NULL DEFAULT 0,
  `createdAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_course_status_sort` (`status`, `sort`),
  KEY `idx_course_category` (`categoryId`),
  CONSTRAINT `fk_course_category` FOREIGN KEY (`categoryId`) REFERENCES `course_category` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '课程';

-- -------------------------------------------------------------
-- 课程章节
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `course_chapter`;
CREATE TABLE `course_chapter` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `courseId`  INT UNSIGNED NOT NULL,
  `title`     VARCHAR(120) NOT NULL,
  `sort`      INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chapter_course` (`courseId`),
  CONSTRAINT `fk_chapter_course` FOREIGN KEY (`courseId`) REFERENCES `course` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '课程章节';

-- -------------------------------------------------------------
-- 课时
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `course_lesson`;
CREATE TABLE `course_lesson` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `chapterId` INT UNSIGNED NOT NULL,
  `courseId`  INT UNSIGNED NOT NULL,
  `title`     VARCHAR(120) NOT NULL,
  `videoUrl`  VARCHAR(500) NULL,
  `duration`  INT NOT NULL DEFAULT 0 COMMENT '时长（秒）',
  `isFree`    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否试看',
  `sort`      INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lesson_course` (`courseId`),
  KEY `idx_lesson_chapter` (`chapterId`),
  CONSTRAINT `fk_lesson_course` FOREIGN KEY (`courseId`) REFERENCES `course` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lesson_chapter` FOREIGN KEY (`chapterId`) REFERENCES `course_chapter` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '课时';

-- -------------------------------------------------------------
-- 已购课程 / 学习进度
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `user_course`;
CREATE TABLE `user_course` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId`       INT UNSIGNED NOT NULL,
  `courseId`     INT UNSIGNED NOT NULL,
  `orderId`      INT UNSIGNED NULL,
  `progress`     INT NOT NULL DEFAULT 0 COMMENT '整课进度 0-100',
  `lastLessonId` INT UNSIGNED NULL,
  `lastStudyAt`  DATETIME NULL,
  `expireAt`     DATETIME NULL,
  `createdAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_course` (`userId`, `courseId`),
  KEY `idx_uc_user` (`userId`),
  CONSTRAINT `fk_uc_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uc_course` FOREIGN KEY (`courseId`) REFERENCES `course` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '已购课程与学习进度';

-- -------------------------------------------------------------
-- 单词本
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `word_book`;
CREATE TABLE `word_book` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId`      INT UNSIGNED NOT NULL,
  `name`        VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `isDefault`   TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_book_user` (`userId`),
  CONSTRAINT `fk_book_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '单词本';

-- -------------------------------------------------------------
-- 单词
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `word`;
CREATE TABLE `word` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bookId`       INT UNSIGNED NOT NULL,
  `userId`       INT UNSIGNED NOT NULL,
  `word`         VARCHAR(80) NOT NULL,
  `phonetic`     VARCHAR(80) NULL,
  `translation`  VARCHAR(500) NOT NULL,
  `example`      VARCHAR(500) NULL,
  `exampleZh`    VARCHAR(500) NULL,
  `audioUrl`     VARCHAR(500) NULL,
  `tags`         VARCHAR(255) NULL COMMENT 'JSON 数组',
  `status`       VARCHAR(20) NOT NULL DEFAULT 'NEW' COMMENT 'NEW/LEARNING/MASTERED',
  `reviewCount`  INT NOT NULL DEFAULT 0 COMMENT '连续答对次数',
  `correctCount` INT NOT NULL DEFAULT 0,
  `lastReviewAt` DATETIME NULL,
  `nextReviewAt` DATETIME NULL COMMENT '下次复习时间（艾宾浩斯）',
  `createdAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_word_book_word` (`bookId`, `word`),
  KEY `idx_word_user_status` (`userId`, `status`),
  KEY `idx_word_user_review` (`userId`, `nextReviewAt`),
  CONSTRAINT `fk_word_book` FOREIGN KEY (`bookId`) REFERENCES `word_book` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_word_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '单词';

-- -------------------------------------------------------------
-- 单词复习记录
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `word_review_log`;
CREATE TABLE `word_review_log` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `wordId`    INT UNSIGNED NOT NULL,
  `userId`    INT UNSIGNED NOT NULL,
  `correct`   TINYINT(1) NOT NULL DEFAULT 0,
  `cost`      INT NOT NULL DEFAULT 0 COMMENT '作答耗时（毫秒）',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wrl_word` (`wordId`),
  KEY `idx_wrl_user_time` (`userId`, `createdAt`),
  CONSTRAINT `fk_wrl_word` FOREIGN KEY (`wordId`) REFERENCES `word` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '单词复习记录';

-- -------------------------------------------------------------
-- 学习记录
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `study_record`;
CREATE TABLE `study_record` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId`    INT UNSIGNED NOT NULL,
  `courseId`  INT UNSIGNED NOT NULL,
  `lessonId`  INT UNSIGNED NOT NULL,
  `duration`  INT NOT NULL DEFAULT 0 COMMENT '本次学习时长（秒）',
  `progress`  INT NOT NULL DEFAULT 0 COMMENT '该课时完成度',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sr_user_time` (`userId`, `createdAt`),
  KEY `idx_sr_user_course` (`userId`, `courseId`),
  CONSTRAINT `fk_sr_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '学习记录';

-- -------------------------------------------------------------
-- 订单
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `order`;
CREATE TABLE `order` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `orderNo`       VARCHAR(40) NOT NULL,
  `userId`        INT UNSIGNED NOT NULL,
  `courseId`      INT UNSIGNED NOT NULL,
  `amount`        INT NOT NULL COMMENT '实付金额（分）',
  `status`        VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/PAID/CANCELLED/REFUNDED',
  `payType`       VARCHAR(20) NOT NULL DEFAULT 'ALIPAY' COMMENT 'ALIPAY/BALANCE/FREE',
  `alipayTradeNo` VARCHAR(64) NULL,
  `paidAt`        DATETIME NULL,
  `cancelledAt`   DATETIME NULL,
  `notifyRaw`     TEXT NULL COMMENT '支付宝异步通知原文',
  `createdAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`orderNo`),
  KEY `idx_order_user_status` (`userId`, `status`),
  KEY `idx_order_status_time` (`status`, `createdAt`),
  CONSTRAINT `fk_order_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_course` FOREIGN KEY (`courseId`) REFERENCES `course` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '订单';

-- -------------------------------------------------------------
-- AI 角色
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `ai_role`;
CREATE TABLE `ai_role` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(50) NOT NULL COMMENT '角色编码，唯一',
  `name`         VARCHAR(50) NOT NULL,
  `avatar`       VARCHAR(500) NULL,
  `description`  VARCHAR(255) NULL,
  `systemPrompt` TEXT NOT NULL,
  `greeting`     VARCHAR(500) NOT NULL DEFAULT '',
  `category`     VARCHAR(50) NOT NULL DEFAULT 'general',
  `enableSearch` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许联网搜索',
  `enabled`      TINYINT(1) NOT NULL DEFAULT 1,
  `sort`         INT NOT NULL DEFAULT 0,
  `createdAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ai_role_code` (`code`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 角色';

-- -------------------------------------------------------------
-- 会话
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `conversation`;
CREATE TABLE `conversation` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId`       INT UNSIGNED NOT NULL,
  `roleId`       INT UNSIGNED NOT NULL,
  `title`        VARCHAR(120) NOT NULL DEFAULT '新会话',
  `lastMessage`  VARCHAR(500) NULL,
  `messageCount` INT NOT NULL DEFAULT 0,
  `createdAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conv_user_time` (`userId`, `updatedAt`),
  CONSTRAINT `fk_conv_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conv_role` FOREIGN KEY (`roleId`) REFERENCES `ai_role` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 会话';

-- -------------------------------------------------------------
-- 消息
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `message`;
CREATE TABLE `message` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversationId` INT UNSIGNED NOT NULL,
  `role`           VARCHAR(20) NOT NULL COMMENT 'user/assistant/system/tool',
  `content`        TEXT NOT NULL,
  `toolCalls`      TEXT NULL COMMENT 'JSON：ReAct 工具调用轨迹',
  `tokens`         INT NULL,
  `createdAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_conv_time` (`conversationId`, `createdAt`),
  CONSTRAINT `fk_msg_conv` FOREIGN KEY (`conversationId`) REFERENCES `conversation` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '会话消息';

-- -------------------------------------------------------------
-- LangGraph Checkpoint 持久化（会话状态）
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `checkpoints`;
CREATE TABLE `checkpoints` (
  `thread_id`            VARCHAR(64) NOT NULL COMMENT '业务侧约定为 conv-{conversationId}',
  `checkpoint_ns`        VARCHAR(64) NOT NULL DEFAULT '',
  `checkpoint_id`        VARCHAR(64) NOT NULL,
  `parent_checkpoint_id` VARCHAR(64) NULL,
  `type`                 VARCHAR(32) NULL COMMENT '序列化类型',
  `checkpoint`           LONGTEXT NOT NULL,
  `metadata`             LONGTEXT NOT NULL,
  PRIMARY KEY (`thread_id`, `checkpoint_ns`, `checkpoint_id`),
  KEY `idx_ckpt_thread` (`thread_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'LangGraph 检查点';

DROP TABLE IF EXISTS `checkpoint_blobs`;
CREATE TABLE `checkpoint_blobs` (
  `thread_id`     VARCHAR(64) NOT NULL,
  `checkpoint_ns` VARCHAR(64) NOT NULL DEFAULT '',
  `channel`       VARCHAR(128) NOT NULL,
  `version`       VARCHAR(64) NOT NULL,
  `type`          VARCHAR(32) NOT NULL,
  `blob`          LONGTEXT NULL,
  PRIMARY KEY (`thread_id`, `checkpoint_ns`, `channel`, `version`),
  KEY `idx_ckptb_thread` (`thread_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'LangGraph 通道数据';

DROP TABLE IF EXISTS `checkpoint_writes`;
CREATE TABLE `checkpoint_writes` (
  `thread_id`     VARCHAR(64) NOT NULL,
  `checkpoint_ns` VARCHAR(64) NOT NULL DEFAULT '',
  `checkpoint_id` VARCHAR(64) NOT NULL,
  `task_id`       VARCHAR(64) NOT NULL,
  `idx`           INT NOT NULL,
  `channel`       VARCHAR(128) NOT NULL,
  `type`          VARCHAR(32) NOT NULL,
  `blob`          LONGTEXT NOT NULL,
  PRIMARY KEY (`thread_id`, `checkpoint_ns`, `checkpoint_id`, `task_id`, `idx`),
  KEY `idx_ckptw_thread` (`thread_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'LangGraph 待写数据';

-- -------------------------------------------------------------
-- 学习日报
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `daily_report`;
CREATE TABLE `daily_report` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId`     INT UNSIGNED NOT NULL,
  `reportDate` VARCHAR(10) NOT NULL COMMENT 'YYYY-MM-DD',
  `content`    TEXT NOT NULL COMMENT 'AI 生成的日报正文',
  `stats`      TEXT NULL COMMENT 'JSON：生成时的统计快照',
  `emailed`    TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_report_user_date` (`userId`, `reportDate`),
  CONSTRAINT `fk_report_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '学习日报';

-- -------------------------------------------------------------
-- 文件对象
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `file_object`;
CREATE TABLE `file_object` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId`         INT UNSIGNED NOT NULL,
  `bucket`         VARCHAR(64) NOT NULL,
  `objectKey`      VARCHAR(500) NOT NULL,
  `url`            VARCHAR(500) NOT NULL,
  `name`           VARCHAR(255) NOT NULL,
  `size`           INT NOT NULL COMMENT '字节',
  `mimeType`       VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
  `hash`           VARCHAR(64) NOT NULL COMMENT '内容 hash，秒传依据',
  `status`         VARCHAR(20) NOT NULL DEFAULT 'UPLOADING' COMMENT 'UPLOADING/COMPLETED/FAILED',
  `totalChunks`    INT NOT NULL DEFAULT 1,
  `uploadedChunks` TEXT NULL COMMENT 'JSON：已上传分片序号',
  `createdAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_file_hash_size` (`hash`, `size`),
  KEY `idx_file_user` (`userId`),
  CONSTRAINT `fk_file_user` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '文件对象';

-- -------------------------------------------------------------
-- 通知公告
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `notice`;
CREATE TABLE `notice` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`     VARCHAR(120) NOT NULL,
  `content`   TEXT NOT NULL,
  `type`      VARCHAR(20) NOT NULL DEFAULT 'SYSTEM' COMMENT 'SYSTEM/ACTIVITY/COURSE',
  `published` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '通知公告';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
--  初始数据
-- =============================================================

-- 用户：admin / admin123        demo / 123456
INSERT INTO `user` (`id`, `username`, `email`, `password`, `nickname`, `avatar`, `bio`, `role`, `status`) VALUES
(1, 'admin', 'admin@linguaflow.com', '$2a$10$MdI5dfPcAkV5IvXGEMa2meofvApoXy8ZsvRDa33CH13DYZu1cn3VW', '超级管理员', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin', '平台管理员', 'ADMIN', 'ACTIVE'),
(2, 'demo',  'demo@linguaflow.com',  '$2a$10$/iRW.MWSMf/Aol1X.tT4Eu6EUD9P0b3qjjGPiCeUQjU0.t0XhQZz6',  '演示同学',   'https://api.dicebear.com/7.x/avataaars/svg?seed=demo', '正在准备雅思，目标 7.0', 'USER', 'ACTIVE');

-- 课程分类
INSERT INTO `course_category` (`id`, `name`, `sort`) VALUES
(1, '口语表达', 1),
(2, '词汇语法', 2),
(3, '听力训练', 3),
(4, '考试冲刺', 4);

-- 课程
INSERT INTO `course` (`id`, `title`, `subtitle`, `cover`, `description`, `price`, `originalPrice`, `level`, `categoryId`, `teacher`, `duration`, `lessonCount`, `studentCount`, `rating`, `tags`, `status`, `sort`) VALUES
(1, '零基础英语口语突破', '从不敢开口到日常流利对话，30 天见效', 'https://picsum.photos/seed/elp1/640/360',
 '本课程专为「学了多年英语却不敢开口」的同学设计。\n\n课程从一个真实场景出发：点咖啡、问路、自我介绍、面试寒暄，每个场景拆成 3 个步骤——\n① 必备句型（背下来就能用）\n② 高频替换词（让表达不重复）\n③ 情景模拟（AI 角色陪练）\n\n配合平台 AI 口语教练，你可以在每节课后立刻进行对话练习，学到就能用上。',
 9900, 19900, 'BEGINNER', 1, 'Lucy Chen', 7380, 9, 386, 4.9, '["口语","零基础","日常对话"]', 'PUBLISHED', 1),
(2, '雅思核心词汇 3000 精讲', '按高频场景分组记忆，配套艾宾浩斯复习计划', 'https://picsum.photos/seed/elp2/640/360',
 '词汇书背了三遍还是记不住？因为你在按字母表背。\n\n本课程按「雅思真题场景」重新切分 3000 核心词：学术讲座高频词、图表描述词、观点表达词、连接逻辑词。每个词给出真题语境例句，而不是干巴巴的释义。\n\n课程配套平台单词本功能，可以把重点词一键加入生词本，系统会按遗忘曲线自动排期复习。',
 12900, 25900, 'INTERMEDIATE', 2, 'Mike Wang', 5400, 6, 268, 4.8, '["雅思","词汇","备考"]', 'PUBLISHED', 2),
(3, '英语语法体系精讲（从时态到从句）', '一张图搞懂英语语法骨架，拒绝零散记忆', 'https://picsum.photos/seed/elp3/640/360',
 '很多人学语法的痛苦在于：知识点是散的。\n\n本课程先建立「一个句子只有一套主谓」的骨架认知，再逐层扩展：时态（时间维度）→ 语态（主被动）→ 非谓语（句子降级）→ 从句（成分替换）。\n\n每节课都有「中国学生最容易错的 3 个点」，直接对着你的痛点讲。',
 14900, 29900, 'INTERMEDIATE', 2, 'Mike Wang', 3840, 4, 197, 4.9, '["语法","时态","从句"]', 'PUBLISHED', 3),
(4, '四六级听力真题精听训练', '逐句精听 + 考点拆解，把听力变成得分项', 'https://picsum.photos/seed/elp4/640/360',
 '听力提分只有一条路：精听。\n\n本课程选取近 5 年四六级真题听力，每段音频按「盲听 → 逐句精听 → 考点定位 → 跟读复述」四步训练。每条题都会告诉你：答案信号词出现在哪里、干扰项是怎么设置的。',
 11900, 21900, 'ADVANCED', 3, 'Sophia Liu', 3780, 4, 142, 4.7, '["四六级","听力","真题"]', 'PUBLISHED', 4),
(5, '商务英语邮件与会议表达', '写给客户的邮件，一次就过稿', 'https://picsum.photos/seed/elp5/640/360',
 '写英文邮件最怕两件事：语气不对、逻辑不清。\n\n本课程提供 12 类商务邮件的「可套用骨架」：询价、报价、催款、道歉、拒绝、跟进……每个骨架标注哪些地方必须改、哪些地方照抄就行。\n\n会议场景则覆盖：如何礼貌打断、如何提出反对意见、如何做会议小结。',
 15900, NULL, 'ADVANCED', 1, 'Sophia Liu', 3420, 4, 88, 4.8, '["商务","写作","职场"]', 'PUBLISHED', 5),
(6, '英语语音语调矫正', '让老外一听就懂的发音训练', 'https://picsum.photos/seed/elp6/640/360',
 '免费公开课。发音不准，别人就要多花 3 秒才能听懂你。\n\n本课程聚焦中国学生最常见的 12 个发音问题：th 音、长短元音区分、词尾辅音、重音位置、句子语调。每节课 15 分钟，跟着念就行。',
 0, 0, 'BEGINNER', 1, 'Lucy Chen', 1380, 2, 1240, 4.9, '["发音","免费课","语音"]', 'PUBLISHED', 6);

-- 章节
INSERT INTO `course_chapter` (`id`, `courseId`, `title`, `sort`) VALUES
(1, 1, '第一章 开口前的准备', 0),
(2, 1, '第二章 高频生活场景', 1),
(3, 1, '第三章 职场与社交', 2),
(4, 2, '第一章 学术讲座高频词', 0),
(5, 2, '第二章 写作高分词', 1),
(6, 3, '第一章 动词时态体系', 0),
(7, 3, '第二章 从句与写作', 1),
(8, 4, '第一章 短篇新闻', 0),
(9, 4, '第二章 长对话与讲座', 1),
(10, 5, '第一章 商务邮件骨架', 0),
(11, 5, '第二章 会议英语', 1),
(12, 6, '第一章 单音纠正', 0);

-- 课时
INSERT INTO `course_lesson` (`id`, `chapterId`, `courseId`, `title`, `duration`, `isFree`, `sort`, `videoUrl`) VALUES
( 1,  1, 1, '01 发音基础：元音与辅音',        720, 1, 0, ''),
( 2,  1, 1, '02 连读与弱读，让口语更自然',    840, 1, 1, ''),
( 3,  1, 1, '03 用「三句话」完成自我介绍',    660, 0, 2, ''),
( 4,  2, 1, '04 在咖啡店点单',               780, 0, 0, ''),
( 5,  2, 1, '05 问路与指路',                 720, 0, 1, ''),
( 6,  2, 1, '06 电话预约与改约',             900, 0, 2, ''),
( 7,  3, 1, '07 面试开场与自我陈述',        1020, 0, 0, ''),
( 8,  3, 1, '08 会议中的表达与打断',         960, 0, 1, ''),
( 9,  3, 1, '09 用英语进行小范围寒暄',       780, 0, 2, ''),
(10,  4, 2, '01 讲座开场与话题引入',         900, 1, 0, ''),
(11,  4, 2, '02 数据与趋势描述',             960, 0, 1, ''),
(12,  4, 2, '03 因果与论证词',               840, 0, 2, ''),
(13,  5, 2, '04 观点表达升级',               900, 0, 0, ''),
(14,  5, 2, '05 让步与转折',                 780, 0, 1, ''),
(15,  5, 2, '06 图表作文专用表达',          1020, 0, 2, ''),
(16,  6, 3, '01 一般时与进行时的本质区别',   900, 1, 0, ''),
(17,  6, 3, '02 完成时到底在表达什么',      1080, 0, 1, ''),
(18,  7, 3, '03 定语从句：把两句话合并成一句', 960, 0, 0, ''),
(19,  7, 3, '04 名词性从句的使用边界',       900, 0, 1, ''),
(20,  8, 4, '01 新闻高频词与语速适应',       900, 1, 0, ''),
(21,  8, 4, '02 数字与时间信息捕捉',         840, 0, 1, ''),
(22,  9, 4, '03 长对话的逻辑标记词',         960, 0, 0, ''),
(23,  9, 4, '04 讲座题的观点与例证',        1080, 0, 1, ''),
(24, 10, 5, '01 邮件语气的三个档位',         780, 1, 0, ''),
(25, 10, 5, '02 催款与道歉邮件模板',         900, 0, 1, ''),
(26, 11, 5, '03 如何礼貌地打断与提问',       840, 0, 0, ''),
(27, 11, 5, '04 会议总结与行动项确认',       900, 0, 1, ''),
(28, 12, 6, '01 th 音的两种读法',            720, 1, 0, ''),
(29, 12, 6, '02 长短元音：ship 与 sheep',    660, 1, 1, '');

-- AI 角色
INSERT INTO `ai_role` (`id`, `code`, `name`, `avatar`, `description`, `systemPrompt`, `greeting`, `category`, `enableSearch`, `enabled`, `sort`) VALUES
(1, 'general', '英语学习助手', 'https://api.dicebear.com/7.x/bottts/svg?seed=general',
 '全能型英语陪练，语法、词汇、翻译都能问',
 '你是一名专业的英语学习助手，帮助学生提升英语听说读写能力。\n回答要求：\n1. 优先用中文解释，英文例句保留英文原文；\n2. 讲解语法或词汇时给出清晰的对比和例句；\n3. 语气亲切、鼓励为主，不要输出与英语学习无关的内容。',
 'Hi！我是你的英语学习助手，今天想练点什么？', 'general', 1, 1, 1),
(2, 'oral-coach', '口语教练 Lucy', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lucy',
 '模拟真实场景对话，纠正你的表达习惯',
 '你是口语教练 Lucy，用中英双语帮助用户练习口语。\n规则：\n1. 先给出英文示范表达，再用中文解释为什么这么说；\n2. 用户说错时先肯定，再指出 1 个最需要改的点，不要一次全部纠错；\n3. 每次回复最后抛出一个开放性问题，引导用户继续说；\n4. 场景化练习时，帮用户补充地道的口语短句。',
 "Hey there! I'm Lucy. Shall we practice some real-life conversations today?", 'oral', 0, 1, 2),
(3, 'grammar-tutor', '语法导师 Mike', 'https://api.dicebear.com/7.x/bottts/svg?seed=mike',
 '把复杂语法讲成大白话，配例句对比',
 '你是语法导师 Mike，擅长把复杂语法讲成大白话。\n规则：\n1. 先用一句话说清规则的核心；\n2. 用「错误示例 vs 正确示例」对照说明；\n3. 给出 3 个由易到难的例句；\n4. 指出中国学生最容易踩的坑。',
 '我是语法导师 Mike。有哪个语法点一直搞不清？说出来我帮你拆开讲。', 'grammar', 0, 1, 3),
(4, 'exam-plan', '备考规划师', 'https://api.dicebear.com/7.x/bottts/svg?seed=exam',
 '雅思托福四六级备考规划，支持查最新考情',
 '你是英语考试备考规划师，服务雅思、托福、四六级考生。\n规则：\n1. 先问清目标分数、当前水平和剩余时间，再给计划；\n2. 计划要具体到「每天做什么、做多久」；\n3. 涉及考试政策、报名时间、题型变化等时效性信息时，必须先用 web_search 工具检索；\n4. 检索结果要注明来源，不确定的信息明确告知用户需要以官方为准。',
 '准备考什么？告诉我目标分数和剩余时间，我帮你排一个可执行的计划。', 'exam', 1, 1, 4);

-- 公告
INSERT INTO `notice` (`id`, `title`, `content`, `type`, `published`) VALUES
(1, '平台上线公告',
 'LinguaFlow 英语学习平台正式上线！\n\n本次版本包含：课程学习、单词本与艾宾浩斯复习、AI 智能对话（多角色 / 上下文记忆 / 联网搜索）、学习日报自动推送等核心功能。祝你学习愉快！',
 'SYSTEM', 1),
(2, '新课上线：英语语音语调矫正（限时免费）',
 '由 Lucy 老师主讲的发音矫正课已上线，限时免费开放，快去课程中心领取吧。',
 'COURSE', 1),
(3, '每日学习日报已开启',
 '系统每天 21:00 会自动汇总你的学习数据，由 AI 生成个性化学习日报并发送到注册邮箱，可在「个人中心 → 学习日报」中查看历史记录。',
 'ACTIVITY', 1);

-- demo 用户默认单词本 + 单词
INSERT INTO `word_book` (`id`, `userId`, `name`, `description`, `isDefault`) VALUES
(1, 2, '我的生词本', '默认单词本', 1);

INSERT INTO `word` (`bookId`, `userId`, `word`, `phonetic`, `translation`, `example`, `exampleZh`, `tags`, `status`, `nextReviewAt`) VALUES
(1, 2, 'abandon',   '/əˈbændən/',  'v. 放弃；抛弃',    'Never abandon your dream.',          '永远不要放弃你的梦想。',       '["starter"]', 'NEW', NOW()),
(1, 2, 'benefit',   '/ˈbenɪfɪt/',  'n. 好处 v. 受益',  'Reading benefits us a lot.',         '阅读让我们受益匪浅。',         '["starter"]', 'NEW', NOW()),
(1, 2, 'crucial',   '/ˈkruːʃl/',   'adj. 至关重要的',  'Practice is crucial to fluency.',    '练习对流畅表达至关重要。',     '["starter"]', 'NEW', NOW()),
(1, 2, 'diligent',  '/ˈdɪlɪdʒənt/', 'adj. 勤奋的',     'She is a diligent learner.',         '她是个勤奋的学习者。',         '["starter"]', 'NEW', NOW()),
(1, 2, 'efficient', '/ɪˈfɪʃnt/',   'adj. 高效的',      'Find an efficient way to learn.',    '找到高效的学习方法。',         '["starter"]', 'NEW', NOW()),
(1, 2, 'fluent',    '/ˈfluːənt/',  'adj. 流利的',      'He is fluent in English.',           '他英语说得很流利。',           '["starter"]', 'NEW', NOW()),
(1, 2, 'genuine',   '/ˈdʒenjuɪn/', 'adj. 真诚的；真正的', 'She showed genuine interest.',    '她表现出真诚的兴趣。',         '["starter"]', 'NEW', NOW()),
(1, 2, 'hesitate',  '/ˈhezɪteɪt/', 'v. 犹豫',          'Do not hesitate to ask.',            '不要犹豫，尽管问。',           '["starter"]', 'NEW', NOW());

-- demo 用户示例订单 + 已购课程
INSERT INTO `order` (`id`, `orderNo`, `userId`, `courseId`, `amount`, `status`, `payType`, `alipayTradeNo`, `paidAt`, `createdAt`) VALUES
(1, 'ELP20260101DEMO0001', 2, 1, 9900, 'PAID', 'ALIPAY', 'MOCKELP20260101DEMO0001', NOW(), NOW());

INSERT INTO `user_course` (`userId`, `courseId`, `orderId`, `progress`, `lastLessonId`, `lastStudyAt`) VALUES
(2, 1, 1, 22, 2, NOW());

INSERT INTO `study_record` (`userId`, `courseId`, `lessonId`, `duration`, `progress`, `createdAt`) VALUES
(2, 1, 1, 720,  100, NOW() - INTERVAL 2 DAY),
(2, 1, 2, 840,  100, NOW() - INTERVAL 1 DAY),
(2, 1, 3, 600,  90,  NOW());

-- demo 用户示例会话
INSERT INTO `conversation` (`id`, `userId`, `roleId`, `title`, `lastMessage`, `messageCount`, `createdAt`) VALUES
(1, 2, 1, '现在完成时怎么用', '现在完成时强调「过去发生的动作对现在造成的影响」……', 2, NOW());

INSERT INTO `message` (`conversationId`, `role`, `content`) VALUES
(1, 'user', '现在完成时和一般过去时有什么区别？'),
(1, 'assistant',
 '核心区别在于「关注点」不同：\n\n· 一般过去时：只说明过去发生了这件事\n  I lost my key yesterday.\n\n· 现在完成时：强调这件事对现在的影响\n  I have lost my key.（所以我现在进不了门）\n\n一句话记：**过去时看过去，完成时看现在。**');

-- =============================================================
--  完成
--  用户端登录：demo  / 123456
--  管理端登录：admin / admin123
-- =============================================================

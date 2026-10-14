import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlipaySdk } from 'alipay-sdk';

export interface AlipayCreateParams {
  orderNo: string;
  /** 金额（元，字符串，两位小数） */
  amount: string;
  subject: string;
  body?: string;
}

/**
 * 支付宝服务
 * 未配置 appId/私钥时自动降级为 Mock 模式：
 * 返回一个本地「模拟收银台」HTML，点击即触发异步回调，便于本地跑通支付闭环。
 */
@Injectable()
export class AlipayService {
  private readonly logger = new Logger(AlipayService.name);
  private readonly sdk?: AlipaySdk;
  private readonly mock: boolean;
  private readonly notifyUrl: string;
  private readonly returnUrl: string;
  private readonly appId: string;

  constructor(private readonly config: ConfigService) {
    const alipay = this.config.get('alipay');
    this.appId = alipay.appId;
    this.notifyUrl = alipay.notifyUrl;
    this.returnUrl = alipay.returnUrl;
    this.mock = !alipay.appId || !alipay.privateKey;

    if (!this.mock) {
      this.sdk = new AlipaySdk({
        appId: alipay.appId,
        privateKey: alipay.privateKey,
        alipayPublicKey: alipay.alipayPublicKey,
        gateway: alipay.gateway,
        signType: 'RSA2',
        timeout: 15_000,
      });
      this.logger.log('支付宝 SDK 已初始化（正式/沙箱模式）');
    } else {
      this.logger.warn('支付宝未配置密钥 —— 已启用 Mock 模式，仅用于本地联调');
    }
  }

  get isMock() {
    return this.mock;
  }

  /** 生成 PC 网页支付表单 HTML */
  async createPagePay(params: AlipayCreateParams): Promise<{ payForm: string; mock: boolean }> {
    if (this.mock) {
      return { payForm: this.buildMockCashier(params), mock: true };
    }
    try {
      const form = this.sdk!.pageExec('alipay.trade.page.pay', {
        method: 'POST',
        bizContent: {
          out_trade_no: params.orderNo,
          product_code: 'FAST_INSTANT_TRADE_PAY',
          total_amount: params.amount,
          subject: params.subject,
          body: params.body,
        },
        notifyUrl: this.notifyUrl,
        returnUrl: this.returnUrl,
      });
      return { payForm: String(form), mock: false };
    } catch (e) {
      this.logger.error(`生成支付表单失败：${(e as Error).message}`);
      throw new ServiceUnavailableException('支付宝下单失败，请稍后重试');
    }
  }

  /** 校验异步通知签名 */
  checkNotifySign(params: Record<string, any>): boolean {
    if (this.mock) {
      // Mock 模式只在非生产环境跳过验签；生产环境未配置密钥时一律拒绝，
      // 避免伪造的 notify 直接把订单改成已支付
      const env = this.config.get<string>('app.env') ?? 'development';
      if (env === 'production') {
        this.logger.error('生产环境未配置支付宝密钥，拒绝处理异步通知');
        return false;
      }
      this.logger.warn('Mock 模式：跳过支付宝验签（仅限本地联调）');
      return true;
    }
    try {
      return this.sdk!.checkNotifySign(params);
    } catch (e) {
      this.logger.error(`验签异常：${(e as Error).message}`);
      return false;
    }
  }

  /** 主动查询交易状态（用于对账 / 补偿） */
  async queryTrade(orderNo: string) {
    if (this.mock) {
      return { tradeStatus: 'TRADE_SUCCESS', tradeNo: `MOCK${orderNo}` };
    }
    const res = await this.sdk!.exec('alipay.trade.query', {
      bizContent: { out_trade_no: orderNo },
    });
    return {
      tradeStatus: (res as any)?.tradeStatus,
      tradeNo: (res as any)?.tradeNo,
      raw: res,
    };
  }

  /**
   * Mock 收银台：一个极简 HTML 页面，
   * 「确认支付」会 POST 到本服务的 notify 接口，模拟支付宝回调：
   *   trade_status=TRADE_SUCCESS & out_trade_no=xxx & total_amount=yyy & sign=xxx
   */
  private buildMockCashier(params: AlipayCreateParams): string {
    const notify = this.notifyUrl || 'http://127.0.0.1:8080/api/payment/alipay/notify';
    const returnUrl = this.returnUrl || 'http://localhost:5173/payment/result';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>沙箱收银台（Mock）</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
       background:linear-gradient(135deg,#e8f2ff 0%,#f5f7fb 100%);color:#1f2937}
  .card{width:360px;background:#fff;border-radius:16px;padding:28px 24px;
        box-shadow:0 18px 48px rgba(31,64,120,.14);text-align:center}
  .logo{width:46px;height:46px;border-radius:12px;background:#1677ff;color:#fff;
        font-size:22px;font-weight:700;line-height:46px;margin:0 auto 14px}
  h1{font-size:17px;font-weight:600;margin-bottom:6px}
  .tip{font-size:12px;color:#8b96a5;margin-bottom:20px}
  .amount{font-size:32px;font-weight:700;color:#1677ff;margin:10px 0 4px}
  .amount small{font-size:16px;font-weight:600}
  .order{font-size:12px;color:#8b96a5;margin-bottom:22px;word-break:break-all}
  button{width:100%;border:0;border-radius:10px;padding:12px 0;font-size:15px;
         font-weight:600;cursor:pointer;transition:.2s}
  .pay{background:#1677ff;color:#fff;margin-bottom:10px}
  .pay:hover{background:#0f62e6}
  .cancel{background:#f2f4f7;color:#5b6472}
  .cancel:hover{background:#e6eaf0}
  .badge{display:inline-block;font-size:11px;color:#b26a00;background:#fff7e6;
         border:1px solid #ffe1a8;border-radius:999px;padding:2px 10px;margin-bottom:12px}
</style>
</head>
<body>
  <div class="card">
    <div class="logo">支</div>
    <div class="badge">Mock 沙箱 · 未接入真实支付宝</div>
    <h1>${escapeHtml(params.subject)}</h1>
    <div class="tip">英语学习平台 · 课程订单</div>
    <div class="amount"><small>¥</small>${escapeHtml(params.amount)}</div>
    <div class="order">订单号：${escapeHtml(params.orderNo)}</div>
    <form id="payForm" method="POST" action="${escapeHtml(notify)}">
      <input type="hidden" name="out_trade_no" value="${escapeHtml(params.orderNo)}" />
      <input type="hidden" name="trade_no" value="MOCK${escapeHtml(params.orderNo)}" />
      <input type="hidden" name="trade_status" value="TRADE_SUCCESS" />
      <input type="hidden" name="total_amount" value="${escapeHtml(params.amount)}" />
      <input type="hidden" name="app_id" value="mock_app_id" />
      <input type="hidden" name="sign" value="mock_sign" />
      <input type="hidden" name="gmt_payment" value="${new Date().toISOString()}" />
      <input type="hidden" name="return_url" value="${escapeHtml(returnUrl)}" />
      <button class="pay" type="submit">确认支付 ¥${escapeHtml(params.amount)}</button>
    </form>
    <form method="POST" action="${escapeHtml(returnUrl)}" onsubmit="return true">
      <button class="cancel" type="submit">取消支付</button>
    </form>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

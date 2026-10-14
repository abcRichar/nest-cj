/**
 * 数据初始化脚本（幂等，可重复执行）
 *   npm run db:seed
 *
 * 说明：如果你已手动导入 sql/english_platform.sql，本脚本会跳过已存在的数据。
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: '口语表达', sort: 1 },
  { name: '词汇语法', sort: 2 },
  { name: '听力训练', sort: 3 },
  { name: '考试冲刺', sort: 4 },
];

const AI_ROLES = [
  {
    code: 'general',
    name: '英语学习助手',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=general',
    description: '全能型英语陪练，语法、词汇、翻译都能问',
    category: 'general',
    enableSearch: true,
    sort: 1,
    greeting: 'Hi！我是你的英语学习助手，今天想练点什么？',
    systemPrompt: `你是一名专业的英语学习助手，帮助学生提升英语听说读写能力。
回答要求：
1. 优先用中文解释，英文例句保留英文原文；
2. 讲解语法或词汇时给出清晰的对比和例句；
3. 语气亲切、鼓励为主，不要输出与英语学习无关的内容。`,
  },
  {
    code: 'oral-coach',
    name: '口语教练 Lucy',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lucy',
    description: '模拟真实场景对话，纠正你的表达习惯',
    category: 'oral',
    enableSearch: false,
    sort: 2,
    greeting: "Hey there! I'm Lucy. Shall we practice some real-life conversations today?",
    systemPrompt: `你是口语教练 Lucy，用中英双语帮助用户练习口语。
规则：
1. 先给出英文示范表达，再用中文解释为什么这么说；
2. 用户说错时先肯定，再指出 1 个最需要改的点，不要一次全部纠错；
3. 每次回复最后抛出一个开放性问题，引导用户继续说；
4. 场景化练习时，帮用户补充地道的口语短句。`,
  },
  {
    code: 'grammar-tutor',
    name: '语法导师 Mike',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=mike',
    description: '把复杂语法讲成大白话，配例句对比',
    category: 'grammar',
    enableSearch: false,
    sort: 3,
    greeting: '我是语法导师 Mike。有哪个语法点一直搞不清？说出来我帮你拆开讲。',
    systemPrompt: `你是语法导师 Mike，擅长把复杂语法讲成大白话。
规则：
1. 先用一句话说清规则的核心；
2. 用「错误示例 vs 正确示例」对照说明；
3. 给出 3 个由易到难的例句；
4. 指出中国学生最容易踩的坑。`,
  },
  {
    code: 'exam-plan',
    name: '备考规划师',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=exam',
    description: '雅思托福四六级备考规划，支持查最新考情',
    category: 'exam',
    enableSearch: true,
    sort: 4,
    greeting: '准备考什么？告诉我目标分数和剩余时间，我帮你排一个可执行的计划。',
    systemPrompt: `你是英语考试备考规划师，服务雅思、托福、四六级考生。
规则：
1. 先问清目标分数、当前水平和剩余时间，再给计划；
2. 计划要具体到「每天做什么、做多久」；
3. 涉及考试政策、报名时间、题型变化等时效性信息时，必须先用 web_search 工具检索；
4. 检索结果要注明来源，不确定的信息明确告知用户需要以官方为准。`,
  },
];

const COURSES = [
  {
    title: '零基础英语口语突破',
    subtitle: '从不敢开口到日常流利对话，30 天见效',
    level: 'BEGINNER',
    price: 9900,
    originalPrice: 19900,
    teacher: 'Lucy Chen',
    category: '口语表达',
    tags: ['口语', '零基础', '日常对话'],
    description:
      '本课程专为「学了多年英语却不敢开口」的同学设计。\n\n' +
      '课程从一个真实场景出发：点咖啡、问路、自我介绍、面试寒暄，每个场景拆成 3 个步骤——\n' +
      '① 必备句型（背下来就能用）\n② 高频替换词（让表达不重复）\n③ 情景模拟（AI 角色陪练）\n\n' +
      '配合平台 AI 口语教练，你可以在每节课后立刻进行对话练习，学到就能用上。',
    chapters: [
      {
        title: '第一章 开口前的准备',
        lessons: [
          { title: '01 发音基础：元音与辅音', duration: 720, isFree: true },
          { title: '02 连读与弱读，让口语更自然', duration: 840, isFree: true },
          { title: '03 用「三句话」完成自我介绍', duration: 660, isFree: false },
        ],
      },
      {
        title: '第二章 高频生活场景',
        lessons: [
          { title: '04 在咖啡店点单', duration: 780, isFree: false },
          { title: '05 问路与指路', duration: 720, isFree: false },
          { title: '06 电话预约与改约', duration: 900, isFree: false },
        ],
      },
      {
        title: '第三章 职场与社交',
        lessons: [
          { title: '07 面试开场与自我陈述', duration: 1020, isFree: false },
          { title: '08 会议中的表达与打断', duration: 960, isFree: false },
          { title: '09 用英语进行小范围寒暄', duration: 780, isFree: false },
        ],
      },
    ],
  },
  {
    title: '雅思核心词汇 3000 精讲',
    subtitle: '按高频场景分组记忆，配套艾宾浩斯复习计划',
    level: 'INTERMEDIATE',
    price: 12900,
    originalPrice: 25900,
    teacher: 'Mike Wang',
    category: '词汇语法',
    tags: ['雅思', '词汇', '备考'],
    description:
      '词汇书背了三遍还是记不住？因为你在按字母表背。\n\n' +
      '本课程按「雅思真题场景」重新切分 3000 核心词：学术讲座高频词、图表描述词、\n' +
      '观点表达词、连接逻辑词。每个词给出真题语境例句，而不是干巴巴的释义。\n\n' +
      '课程配套平台单词本功能，可以把重点词一键加入生词本，系统会按遗忘曲线自动排期复习。',
    chapters: [
      {
        title: '第一章 学术讲座高频词',
        lessons: [
          { title: '01 讲座开场与话题引入', duration: 900, isFree: true },
          { title: '02 数据与趋势描述', duration: 960, isFree: false },
          { title: '03 因果与论证词', duration: 840, isFree: false },
        ],
      },
      {
        title: '第二章 写作高分词',
        lessons: [
          { title: '04 观点表达升级', duration: 900, isFree: false },
          { title: '05 让步与转折', duration: 780, isFree: false },
          { title: '06 图表作文专用表达', duration: 1020, isFree: false },
        ],
      },
    ],
  },
  {
    title: '英语语法体系精讲（从时态到从句）',
    subtitle: '一张图搞懂英语语法骨架，拒绝零散记忆',
    level: 'INTERMEDIATE',
    price: 14900,
    originalPrice: 29900,
    teacher: 'Mike Wang',
    category: '词汇语法',
    tags: ['语法', '时态', '从句'],
    description:
      '很多人学语法的痛苦在于：知识点是散的。\n\n' +
      '本课程先建立「一个句子只有一套主谓」的骨架认知，再逐层扩展：\n' +
      '时态（时间维度）→ 语态（主被动）→ 非谓语（句子降级）→ 从句（成分替换）。\n\n' +
      '每节课都有「中国学生最容易错的 3 个点」，直接对着你的痛点讲。',
    chapters: [
      {
        title: '第一章 动词时态体系',
        lessons: [
          { title: '01 一般时与进行时的本质区别', duration: 900, isFree: true },
          { title: '02 完成时到底在表达什么', duration: 1080, isFree: false },
        ],
      },
      {
        title: '第二章 从句与写作',
        lessons: [
          { title: '03 定语从句：把两句话合并成一句', duration: 960, isFree: false },
          { title: '04 名词性从句的使用边界', duration: 900, isFree: false },
        ],
      },
    ],
  },
  {
    title: '四六级听力真题精听训练',
    subtitle: '逐句精听 + 考点拆解，把听力变成得分项',
    level: 'ADVANCED',
    price: 11900,
    originalPrice: 21900,
    teacher: 'Sophia Liu',
    category: '听力训练',
    tags: ['四六级', '听力', '真题'],
    description:
      '听力提分只有一条路：精听。\n\n' +
      '本课程选取近 5 年四六级真题听力，每段音频按「盲听 → 逐句精听 → 考点定位 → 跟读复述」\n' +
      '四步训练。每条题都会告诉你：答案信号词出现在哪里、干扰项是怎么设置的。',
    chapters: [
      {
        title: '第一章 短篇新闻',
        lessons: [
          { title: '01 新闻高频词与语速适应', duration: 900, isFree: true },
          { title: '02 数字与时间信息捕捉', duration: 840, isFree: false },
        ],
      },
      {
        title: '第二章 长对话与讲座',
        lessons: [
          { title: '03 长对话的逻辑标记词', duration: 960, isFree: false },
          { title: '04 讲座题的观点与例证', duration: 1080, isFree: false },
        ],
      },
    ],
  },
  {
    title: '商务英语邮件与会议表达',
    subtitle: '写给客户的邮件，一次就过稿',
    level: 'ADVANCED',
    price: 15900,
    originalPrice: 0,
    teacher: 'Sophia Liu',
    category: '口语表达',
    tags: ['商务', '写作', '职场'],
    description:
      '写英文邮件最怕两件事：语气不对、逻辑不清。\n\n' +
      '本课程提供 12 类商务邮件的「可套用骨架」：询价、报价、催款、道歉、拒绝、跟进……\n' +
      '每个骨架标注哪些地方必须改、哪些地方照抄就行。\n\n' +
      '会议场景则覆盖：如何礼貌打断、如何提出反对意见、如何做会议小结。',
    chapters: [
      {
        title: '第一章 商务邮件骨架',
        lessons: [
          { title: '01 邮件语气的三个档位', duration: 780, isFree: true },
          { title: '02 催款与道歉邮件模板', duration: 900, isFree: false },
        ],
      },
      {
        title: '第二章 会议英语',
        lessons: [
          { title: '03 如何礼貌地打断与提问', duration: 840, isFree: false },
          { title: '04 会议总结与行动项确认', duration: 900, isFree: false },
        ],
      },
    ],
  },
  {
    title: '英语语音语调矫正',
    subtitle: '让老外一听就懂的发音训练',
    level: 'BEGINNER',
    price: 0,
    originalPrice: 0,
    teacher: 'Lucy Chen',
    category: '口语表达',
    tags: ['发音', '免费课', '语音'],
    description:
      '免费公开课。发音不准，别人就要多花 3 秒才能听懂你。\n\n' +
      '本课程聚焦中国学生最常见的 12 个发音问题：th 音、长短元音区分、词尾辅音、\n' +
      '重音位置、句子语调。每节课 15 分钟，跟着念就行。',
    chapters: [
      {
        title: '第一章 单音纠正',
        lessons: [
          { title: '01 th 音的两种读法', duration: 720, isFree: true },
          { title: '02 长短元音：ship 与 sheep', duration: 660, isFree: true },
        ],
      },
    ],
  },
];

const NOTICES = [
  {
    title: '平台上线公告',
    content:
      'LinguaFlow 英语学习平台正式上线！\n\n' +
      '本次版本包含：课程学习、单词本与艾宾浩斯复习、AI 智能对话（多角色 / 上下文记忆 / 联网搜索）、\n' +
      '学习日报自动推送等核心功能。祝你学习愉快！',
    type: 'SYSTEM',
  },
  {
    title: '新课上线：英语语音语调矫正（限时免费）',
    content: '由 Lucy 老师主讲的发音矫正课已上线，限时免费开放，快去课程中心领取吧。',
    type: 'COURSE',
  },
  {
    title: '每日学习日报已开启',
    content:
      '系统每天 21:00 会自动汇总你的学习数据，由 AI 生成个性化学习日报并发送到注册邮箱，' +
      '可在「个人中心 → 学习日报」中查看历史记录。',
    type: 'ACTIVITY',
  },
];

async function main() {
  console.log('开始初始化数据...');

  /* ---------------------------- 用户 ---------------------------- */
  const adminPwd = await bcrypt.hash('admin123', 10);
  const demoPwd = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@linguaflow.com',
      password: adminPwd,
      nickname: '超级管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
      bio: '平台管理员',
    },
  });

  const demo = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@linguaflow.com',
      password: demoPwd,
      nickname: '演示同学',
      role: 'USER',
      status: 'ACTIVE',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
      bio: '正在准备雅思，目标 7.0',
    },
  });

  console.log(`用户就绪：admin(#${admin.id}) / demo(#${demo.id})`);

  /* ---------------------------- 分类 ---------------------------- */
  const categoryMap = new Map<string, number>();
  for (const c of CATEGORIES) {
    const found = await prisma.courseCategory.findFirst({ where: { name: c.name } });
    const cat = found ?? (await prisma.courseCategory.create({ data: c }));
    categoryMap.set(c.name, cat.id);
  }
  console.log(`课程分类就绪：${CATEGORIES.length} 个`);

  /* ---------------------------- 课程 ---------------------------- */
  let courseCount = 0;
  for (const [idx, c] of COURSES.entries()) {
    const existed = await prisma.course.findFirst({ where: { title: c.title } });
    if (existed) continue;

    const totalDuration = c.chapters.reduce(
      (s, ch) => s + ch.lessons.reduce((a, l) => a + l.duration, 0),
      0,
    );
    const lessonCount = c.chapters.reduce((s, ch) => s + ch.lessons.length, 0);

    const course = await prisma.course.create({
      data: {
        title: c.title,
        subtitle: c.subtitle,
        cover: `https://picsum.photos/seed/elp${idx + 1}/640/360`,
        description: c.description,
        price: c.price,
        originalPrice: c.originalPrice || null,
        level: c.level as any,
        categoryId: categoryMap.get(c.category) ?? null,
        teacher: c.teacher,
        duration: totalDuration,
        lessonCount,
        studentCount: Math.floor(Math.random() * 400) + 60,
        rating: Number((4.6 + Math.random() * 0.4).toFixed(1)),
        tags: JSON.stringify(c.tags),
        status: 'PUBLISHED',
        sort: idx + 1,
      },
    });

    for (const [ci, ch] of c.chapters.entries()) {
      const chapter = await prisma.courseChapter.create({
        data: { courseId: course.id, title: ch.title, sort: ci },
      });
      for (const [li, ls] of ch.lessons.entries()) {
        await prisma.courseLesson.create({
          data: {
            courseId: course.id,
            chapterId: chapter.id,
            title: ls.title,
            duration: ls.duration,
            isFree: ls.isFree,
            sort: li,
            videoUrl: '',
          },
        });
      }
    }
    courseCount += 1;
  }
  console.log(`课程就绪：新增 ${courseCount} 门`);

  /* ---------------------------- AI 角色 ---------------------------- */
  for (const r of AI_ROLES) {
    await prisma.aiRole.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, systemPrompt: r.systemPrompt },
      create: r,
    });
  }
  console.log(`AI 角色就绪：${AI_ROLES.length} 个`);

  /* ---------------------------- 公告 ---------------------------- */
  for (const n of NOTICES) {
    const existed = await prisma.notice.findFirst({ where: { title: n.title } });
    if (!existed) await prisma.notice.create({ data: { ...n, published: true } });
  }
  console.log(`公告就绪：${NOTICES.length} 条`);

  /* ---------------------------- 演示数据 ---------------------------- */
  // demo 用户的默认单词本 + 一批单词
  let book = await prisma.wordBook.findFirst({ where: { userId: demo.id, isDefault: true } });
  if (!book) {
    book = await prisma.wordBook.create({
      data: { userId: demo.id, name: '我的生词本', description: '默认单词本', isDefault: true },
    });
  }
  const wordCount = await prisma.word.count({ where: { userId: demo.id } });
  if (wordCount === 0) {
    await prisma.word.createMany({
      data: [
        { word: 'abandon', phonetic: '/əˈbændən/', translation: 'v. 放弃；抛弃', example: 'Never abandon your dream.', exampleZh: '永远不要放弃你的梦想。' },
        { word: 'benefit', phonetic: '/ˈbenɪfɪt/', translation: 'n. 好处 v. 受益', example: 'Reading benefits us a lot.', exampleZh: '阅读让我们受益匪浅。' },
        { word: 'crucial', phonetic: '/ˈkruːʃl/', translation: 'adj. 至关重要的', example: 'Practice is crucial to fluency.', exampleZh: '练习对流畅表达至关重要。' },
        { word: 'diligent', phonetic: '/ˈdɪlɪdʒənt/', translation: 'adj. 勤奋的', example: 'She is a diligent learner.', exampleZh: '她是个勤奋的学习者。' },
        { word: 'efficient', phonetic: '/ɪˈfɪʃnt/', translation: 'adj. 高效的', example: 'Find an efficient way to learn.', exampleZh: '找到高效的学习方法。' },
        { word: 'fluent', phonetic: '/ˈfluːənt/', translation: 'adj. 流利的', example: 'He is fluent in English.', exampleZh: '他英语说得很流利。' },
        { word: 'genuine', phonetic: '/ˈdʒenjuɪn/', translation: 'adj. 真诚的；真正的', example: 'She showed genuine interest.', exampleZh: '她表现出真诚的兴趣。' },
        { word: 'hesitate', phonetic: '/ˈhezɪteɪt/', translation: 'v. 犹豫', example: "Don't hesitate to ask.", exampleZh: '不要犹豫，尽管问。' },
      ].map((w) => ({
        ...w,
        bookId: book!.id,
        userId: demo.id,
        status: 'NEW',
        tags: '["starter"]',
        nextReviewAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  // demo 用户已购课程
  const firstCourse = await prisma.course.findFirst({ where: { status: 'PUBLISHED' }, orderBy: { id: 'asc' } });
  if (firstCourse) {
    const owned = await prisma.userCourse.findUnique({
      where: { userId_courseId: { userId: demo.id, courseId: firstCourse.id } },
    });
    if (!owned) {
      await prisma.userCourse.create({
        data: { userId: demo.id, courseId: firstCourse.id, progress: 22 },
      });
      await prisma.order.create({
        data: {
          orderNo: `ELP${Date.now()}DEMO01`,
          userId: demo.id,
          courseId: firstCourse.id,
          amount: firstCourse.price,
          status: 'PAID',
          payType: 'ALIPAY',
          paidAt: new Date(),
        },
      });
    }
  }

  // demo 用户对话示例
  const role = await prisma.aiRole.findUnique({ where: { code: 'general' } });
  if (role) {
    const convCount = await prisma.conversation.count({ where: { userId: demo.id } });
    if (convCount === 0) {
      const conv = await prisma.conversation.create({
        data: {
          userId: demo.id,
          roleId: role.id,
          title: '现在完成时怎么用',
          lastMessage: '现在完成时强调「过去发生的动作对现在造成的影响」……',
          messageCount: 2,
        },
      });
      await prisma.message.createMany({
        data: [
          { conversationId: conv.id, role: 'user', content: '现在完成时和一般过去时有什么区别？' },
          {
            conversationId: conv.id,
            role: 'assistant',
            content:
              '核心区别在于「关注点」不同：\n\n' +
              '· 一般过去时：只说明过去发生了这件事\n  I lost my key yesterday.\n\n' +
              '· 现在完成时：强调这件事对现在的影响\n  I have lost my key.（所以我现在进不了门）\n\n' +
              '一句话记：**过去时看过去，完成时看现在。**',
          },
        ],
      });
    }
  }

  console.log('数据初始化完成 ✅');
  console.log('');
  console.log('  管理员：admin / admin123');
  console.log('  演示用户：demo / 123456');
}

main()
  .catch((e) => {
    console.error('初始化失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

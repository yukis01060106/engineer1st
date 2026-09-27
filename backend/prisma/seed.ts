import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calcTax, calcSettlement, calcDueDate } from "../src/lib/invoice";

const prisma = new PrismaClient();

async function main() {
  // デモ用ユーザー（ペルソナ: 青木耶雲、稼働中フリーランス2年目）
  const passwordHash = await bcrypt.hash("password123", 10);
  const joinedAt = new Date();
  joinedAt.setFullYear(joinedAt.getFullYear() - 2); // 2年前に登録 = シルバーランク

  const user = await prisma.user.upsert({
    where: { email: "tanaka@example.com" },
    update: {
      name: "青木 耶雲",
      workStyle: "freelance",
      birthYear: new Date().getFullYear() - 32,
      interests: JSON.stringify(["money", "health", "study"]),
    },
    create: {
      email: "tanaka@example.com",
      passwordHash,
      name: "青木 耶雲",
      invoiceRegistrationNumber: "T9876543210987",
      workStyle: "freelance",
      birthYear: new Date().getFullYear() - 32,
      interests: JSON.stringify(["money", "health", "study"]),
      joinedAt,
    },
  });

  // 案件データ
  const projectsData = [
    {
      title: "大手ECサイト リプレイス案件",
      client: "コマースフロンティア株式会社",
      skills: "React,TypeScript,Node.js",
      unitPrice: 700000,
      workStyle: "フルリモート",
      description: "大手ECサイトのフロントエンド刷新プロジェクト。React+TypeScriptでの開発経験者募集。",
    },
    {
      title: "金融系基幹システム保守開発",
      client: "レガシーソリューションズ株式会社",
      skills: "Java,Spring,AWS",
      unitPrice: 650000,
      workStyle: "一部常駐（月2回）",
      description: "金融機関向け基幹システムの保守・機能改修。",
    },
    {
      title: "SaaSプロダクト新規機能開発",
      client: "クラウドギア株式会社",
      skills: "TypeScript,React,Next.js,AWS",
      unitPrice: 800000,
      workStyle: "フルリモート",
      description: "急成長中のSaaSプロダクトにおける新規機能開発。裁量大きめ。",
    },
    {
      title: "AIチャットボット開発",
      client: "テックパートナーズ合同会社",
      skills: "Python,TypeScript,AWS",
      unitPrice: 750000,
      workStyle: "フルリモート",
      description: "生成AIを活用した社内向けチャットボットの開発。",
    },
    {
      title: "モバイルアプリ新規開発",
      client: "スマイルモバイル株式会社",
      skills: "TypeScript,React,Node.js",
      unitPrice: 680000,
      workStyle: "週1出社",
      description: "toC向けモバイルアプリのバックエンドAPI開発。",
    },
  ];

  const projects = [];
  for (const p of projectsData) {
    const existing = await prisma.project.findFirst({ where: { title: p.title } });
    projects.push(existing ?? (await prisma.project.create({ data: p })));
  }

  // 青木さんは現在、AIチャットボット開発で稼働中・終了まで残りわずか（先回りレコメンドのデモ用）。
  // 過去には大手ECサイト リプレイス案件での稼働実績もある。
  const currentEngagement = await prisma.engagement.upsert({
    where: { id: "seed-engagement-current" },
    update: {
      projectId: projects[3].id,
      monthlyRate: 750000,
      endDate: new Date(new Date().setDate(new Date().getDate() + 25)),
      status: "稼働中",
    },
    create: {
      id: "seed-engagement-current",
      userId: user.id,
      projectId: projects[3].id, // AIチャットボット開発
      monthlyRate: 750000,
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 2)),
      endDate: new Date(new Date().setDate(new Date().getDate() + 25)), // 残り25日 → 先回りレコメンドのデモ
      status: "稼働中",
    },
  });

  const pastEngagement = await prisma.engagement.upsert({
    where: { id: "seed-engagement-past" },
    update: {
      projectId: projects[0].id,
      monthlyRate: 700000,
      endDate: new Date(new Date().setMonth(new Date().getMonth() - 4)),
      status: "終了",
    },
    create: {
      id: "seed-engagement-past",
      userId: user.id,
      projectId: projects[0].id, // 大手ECサイト リプレイス案件
      monthlyRate: 700000,
      startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      endDate: new Date(new Date().setMonth(new Date().getMonth() - 4)),
      status: "終了",
    },
  });

  // 請求書サンプル: 過去の稼働分は入金済み。現在の稼働先は「2か月前分＝支払期日超過（未入金）」「先月分＝期日前」
  // → 入金管理と催促文のデモに使う
  const ym = (offset: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  await prisma.invoice.deleteMany({ where: { engagement: { userId: user.id } } });

  const invoiceSeeds = [
    { engagementId: pastEngagement.id, month: ym(6), rate: 700000, hours: 162, paid: true, term: 30 },
    { engagementId: pastEngagement.id, month: ym(5), rate: 700000, hours: 188, paid: true, term: 30 },
    { engagementId: currentEngagement.id, month: ym(2), rate: 750000, hours: 171, paid: false, term: 30 },
    { engagementId: currentEngagement.id, month: ym(1), rate: 750000, hours: 136.5, paid: false, term: 30 },
  ];
  for (const [i, seed] of invoiceSeeds.entries()) {
    const settlement = calcSettlement({ monthlyRate: seed.rate, workHours: seed.hours, settlementMin: 140, settlementMax: 180 });
    const tax = calcTax(settlement.amount, 10);
    const dueDate = calcDueDate(seed.month, seed.term);
    await prisma.invoice.create({
      data: {
        id: `seed-invoice-${i}`,
        engagementId: seed.engagementId,
        targetMonth: seed.month,
        amount: tax.amount,
        baseAmount: settlement.baseAmount,
        workHours: seed.hours,
        adjustment: settlement.adjustment,
        taxRate: tax.taxRate,
        taxAmount: tax.taxAmount,
        totalAmount: tax.totalAmount,
        dueDate,
        paidAt: seed.paid ? new Date(dueDate.getTime() - 2 * 86_400_000) : null,
        status: seed.paid ? "入金済み" : "発行済み",
        registrationNumber: "T9876543210987",
        invoiceNumber: `INV-${seed.month.replace("-", "")}-SEED${i}`,
      },
    });
  }

  // 契約書（現在の稼働先は未締結のままデモ用に残す。過去の稼働先分は締結済み）
  await prisma.contract.upsert({
    where: { id: "seed-contract-current" },
    update: {},
    create: {
      id: "seed-contract-current",
      engagementId: currentEngagement.id,
      title: "業務委託契約書（AIチャットボット開発）",
      body:
        "本契約は、ソトバを通じて青木耶雲氏がテックパートナーズ合同会社の業務に従事するにあたっての条件を定めるものです。稼働期間、報酬、秘密保持等の一般条項を含みます。",
      status: "未締結",
    },
  });

  await prisma.contract.upsert({
    where: { id: "seed-contract-past" },
    update: {
      signedName: "青木 耶雲",
    },
    create: {
      id: "seed-contract-past",
      engagementId: pastEngagement.id,
      title: "業務委託契約書（大手ECサイト リプレイス案件）",
      body:
        "本契約は、ソトバを通じて青木耶雲氏がコマースフロンティア株式会社の業務に従事した業務委託の条件を定めるものです。",
      status: "締結済み",
      signedAt: new Date(new Date().setMonth(new Date().getMonth() - 4)),
      signedName: "青木 耶雲",
    },
  });

  // スキルシート
  const seedSkills = [
    { name: "TypeScript", level: 4, years: 3 },
    { name: "React", level: 4, years: 3 },
    { name: "Node.js", level: 3, years: 2 },
    { name: "AWS", level: 2, years: 1 },
  ];
  const seedExperiences = [
    {
      title: "AIチャットボット開発",
      period: "2026-05〜稼働中",
      role: "バックエンドエンジニア",
      tech: "Python, TypeScript, AWS",
      description: "生成AIを活用した社内向けチャットボットのバックエンドAPI開発を担当。",
    },
    {
      title: "大手ECサイト リプレイス案件",
      period: "2026-04〜2026-06",
      role: "フロントエンドエンジニア",
      tech: "React, TypeScript, Node.js",
      description: "ECサイトのフロントエンド刷新。コンポーネント設計・API連携を担当。",
    },
    {
      title: "金融系基幹システム保守開発",
      period: "2025-03〜2026-03",
      role: "バックエンドエンジニア",
      tech: "Java, Spring, AWS",
      description: "基幹システムの保守・機能改修を担当。",
    },
  ];
  const seedAppealPoints = [
    "TypeScript / React / Node.js を軸としたモダン開発スキルで、画面構築からAPI開発まで独力かつハイレベルに遂行可能。",
    "生成AIを活用したチャットボット開発プロジェクトに参画し、AI技術の実務応用への知見を保有。",
  ];

  const skillSheetData = {
      userId: user.id,
      summary: [
        "■ 基本情報",
        "氏名   ：青木 耶雲",
        "年齢   ：32歳",
        "最寄駅  ：東京都 ※フルリモート希望（月1回は出社可能）",
        "稼働開始 ：2026-08-02以降（応相談）",
        "単価   ：750,000円〜",
        "",
        "■ スキルサマリー（★＝特に強い領域）",
        " フロントエンド：★ TypeScript / ★ React",
        " バックエンド：Node.js / Java",
        " インフラ・環境：AWS",
        "",
        "■ 対応可能工程",
        " 設計 → 開発（フロントエンド） → 開発（バックエンド） → テスト",
        "",
        "■ アピールポイント",
        "1. " + seedAppealPoints[0],
        "2. " + seedAppealPoints[1],
        "",
        "■ 経験概要（IT開発経験：約3年）",
        " バックエンドエンジニアとして3件のプロジェクトに参画。プロジェクト経歴・保有スキルをもとに自動生成されたサマリーです（必要に応じて編集してください）。",
      ].join("\n"),
      skills: JSON.stringify(seedSkills),
      experiences: JSON.stringify(seedExperiences),
      age: 32,
      nearestStation: "東京都 ※フルリモート希望（月1回は出社可能）",
      availability: "2026-08-02以降（応相談）",
      desiredRate: 750000,
      totalExperienceYears: 3,
      workProcesses: JSON.stringify(["設計", "開発（フロントエンド）", "開発（バックエンド）", "テスト"]),
      appealPoints: JSON.stringify(seedAppealPoints),
      remarks:
        "フルリモート環境でも自走力高く安定した成果を出せる自信があります。生成AIを活用した開発にも意欲的に取り組んでいます。",
  };

  await prisma.skillSheet.upsert({
    where: { userId: user.id },
    update: skillSheetData,
    create: skillSheetData,
  });

  // 単価診断の比較母数用データ（匿名・userId: null）。フロントエンドエンジニア×React系を厚めに投入し、
  // 青木さんが診断した際に「似た条件のエンジニア」との比較が機能するようにする。
  const rateDiagnosisSeeds = [
    { skill: "React", role: "フロントエンドエンジニア", years: 2, rate: 600_000 },
    { skill: "React", role: "フロントエンドエンジニア", years: 3, rate: 630_000 },
    { skill: "React", role: "フロントエンドエンジニア", years: 3, rate: 680_000 },
    { skill: "React", role: "フロントエンドエンジニア", years: 4, rate: 700_000 },
    { skill: "React", role: "フロントエンドエンジニア", years: 4, rate: 720_000 },
    { skill: "React", role: "フロントエンドエンジニア", years: 5, rate: 750_000 },
    { skill: "React", role: "フロントエンドエンジニア", years: 2, rate: 610_000 },
    { skill: "Java", role: "バックエンドエンジニア", years: 3, rate: 650_000 },
    { skill: "Java", role: "バックエンドエンジニア", years: 4, rate: 690_000 },
    { skill: "AWS", role: "インフラエンジニア", years: 4, rate: 720_000 },
  ];

  for (const [i, d] of rateDiagnosisSeeds.entries()) {
    await prisma.rateDiagnosis.upsert({
      where: { id: `seed-rate-${i}` },
      update: {
        primarySkill: d.skill,
        role: d.role,
        yearsOfExperience: d.years,
        monthlyRate: d.rate,
      },
      create: {
        id: `seed-rate-${i}`,
        userId: null,
        primarySkill: d.skill,
        role: d.role,
        yearsOfExperience: d.years,
        monthlyRate: d.rate,
      },
    });
  }

  // 経費サンプル
  const expenseSeeds = [
    { id: "seed-expense-0", date: new Date(new Date().setDate(new Date().getDate() - 3)), vendor: "JR東日本", amount: 1200, category: "旅費交通費", memo: "客先訪問の交通費" },
    { id: "seed-expense-1", date: new Date(new Date().setDate(new Date().getDate() - 10)), vendor: "コワーキングスペース渋谷", amount: 3300, category: "会議費", memo: null },
    { id: "seed-expense-2", date: new Date(new Date().setDate(new Date().getDate() - 15)), vendor: "Amazon", amount: 8980, category: "消耗品費", memo: "外付けキーボード" },
  ];
  for (const e of expenseSeeds) {
    await prisma.expense.upsert({
      where: { id: e.id },
      update: { date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, memo: e.memo },
      create: { id: e.id, userId: user.id, date: e.date, vendor: e.vendor, amount: e.amount, category: e.category, memo: e.memo },
    });
  }

  // 部活（健康推進 × 集客）
  const clubsData = [
    {
      slug: "pickleball",
      name: "ピックルボール部",
      catchphrase: "テニスより小さなコートで、初めてでもすぐラリーが続く。",
      description:
        "アメリカで大人気のパドルスポーツ。ルールは10分で覚えられ、運動が久しぶりの人でもすぐにラリーを楽しめます。パドルとボールは貸し出しあり。終わったあとのごはん会で、案件や技術の話も気軽にどうぞ。",
      schedule: "毎月第2・第4土曜 10:00〜12:00",
      place: "都内の屋内コート（渋谷・品川エリア）",
      level: "未経験者歓迎",
      photo: "club-pickleball.webp",
      color: "yellow",
      status: "open",
      sortOrder: 1,
    },
    {
      slug: "training",
      name: "筋トレ部",
      catchphrase: "座りっぱなしの体に、週1回の筋トレを。",
      description:
        "トレーナー経験のある部員がフォームを見ながら、全身をバランスよく鍛えます。肩こり・腰痛の予防にも。ジムで集まる回と、自宅でできるオンラインの回があります。",
      schedule: "毎週水曜 19:30〜20:30（オンライン回は隔週月曜 21:00〜）",
      place: "都内のパーソナルジム／オンライン（Zoom）",
      level: "初心者歓迎",
      photo: "club-training.webp",
      color: "pink",
      status: "open",
      sortOrder: 2,
    },
    {
      slug: "running",
      name: "ランニング部",
      catchphrase: "座りっぱなしの1週間を、土曜の朝にリセット。",
      description:
        "皇居の外周（約5km）を、それぞれのペースで走る部活です。歩いてもOK。走ったあとは近くのカフェで、案件や技術のゆるい雑談をしています。",
      schedule: "毎月第2・第4土曜 7:30〜9:00",
      place: "皇居外周（桜田門集合）",
      level: "初心者・ウォーキング歓迎",
      photo: "club-running.webp",
      color: "mint",
      status: "preparing",
      sortOrder: 3,
    },
    {
      slug: "futsal",
      name: "フットサル部",
      catchphrase: "チームで動くと、現場のコミュニケーションもうまくなる。",
      description:
        "平日夜に2時間、コートを借りてミニゲームをしています。経験者と未経験者が半々くらい。終わったあとのごはん会で、横のつながりが生まれています。",
      schedule: "隔週水曜 19:30〜21:30",
      place: "渋谷のフットサルコート",
      level: "未経験者歓迎",
      photo: "club-futsal.webp",
      color: "mint",
      status: "preparing",
      sortOrder: 4,
    },
    {
      slug: "bouldering",
      name: "ボルダリング部",
      catchphrase: "課題を分解して、一手ずつ解く。登るのも、デバッグも。",
      description:
        "ボルダリングジムで、同じ課題をみんなで攻略します。道具はすべてレンタルできるので、手ぶらで参加できます。",
      schedule: "毎月第1・第3金曜 19:00〜21:00",
      place: "秋葉原のボルダリングジム",
      level: "はじめての人が半分",
      photo: "club-bouldering.webp",
      color: "violet",
      status: "preparing",
      sortOrder: 5,
    },
    {
      slug: "stretch",
      name: "朝ストレッチ部（オンライン）",
      catchphrase: "肩・首・腰。エンジニアの三大不調を、朝15分で。",
      description:
        "平日の朝8:30から15分、オンラインでストレッチをします。カメラオフでもOK。始業前のスイッチ代わりに使ってください。",
      schedule: "平日 8:30〜8:45",
      place: "オンライン（Google Meet）",
      level: "どなたでも",
      photo: "club-stretch.webp",
      color: "violet",
      status: "preparing",
      sortOrder: 6,
    },
  ];
  const clubs: Record<string, { id: string }> = {};
  for (const c of clubsData) {
    clubs[c.slug] = await prisma.club.upsert({ where: { slug: c.slug }, update: c, create: c });
  }

  await prisma.clubMembership.deleteMany({});
  await prisma.clubMembership.create({ data: { userId: user.id, clubId: clubs.pickleball.id } });

  // 勉強会・部活の活動・交流会（日付は実行日から相対で作る）
  const at = (daysLater: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysLater);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  await prisma.eventApplication.deleteMany({});
  await prisma.event.deleteMany({});

  const eventsData = [
    {
      title: "Claude Code 実践：レビューとテストをAIに任せる開発フロー",
      type: "勉強会",
      date: at(5, 20),
      durationMin: 90,
      isOnline: true,
      location: "オンライン（Zoom）",
      joinUrl: "https://zoom.us/j/0000000001",
      speaker: "ソトバ 技術顧問",
      tags: "生成AI,Claude Code,開発効率化",
      description:
        "AIエージェントに実装・テスト・レビューを任せるときの、現場で使える手順を紹介します。SESの現場でAIツールが使えない場合の、個人での練習方法もお話しします。",
      capacity: 100,
    },
    {
      title: "Next.js 16 と React 19 の変更点をまとめて押さえる",
      type: "勉強会",
      date: at(12, 20),
      durationMin: 60,
      isOnline: true,
      location: "オンライン（Google Meet）",
      joinUrl: "https://meet.google.com/aaa-bbbb-ccc",
      speaker: "フロントエンド部会",
      tags: "React,Next.js,フロントエンド",
      description: "Server Components、Actions、キャッシュまわりの変更を、実務で困るポイントに絞って解説します。",
      capacity: 80,
    },
    {
      title: "40代からの単価の上げ方：要件定義・調整役の経験を積む",
      type: "勉強会",
      date: at(19, 20),
      durationMin: 60,
      isOnline: true,
      location: "オンライン（Zoom）",
      joinUrl: "https://zoom.us/j/0000000002",
      speaker: "PM経験者メンター",
      tags: "キャリア,PM,単価",
      description: "開発工程に閉じがちなSESの現場で、調整役・要件定義の経験をどう積むか。実例をもとに話します。",
      capacity: 60,
    },
    {
      title: "ピックルボール部：はじめての人向けラリー練習",
      type: "部活",
      date: at(7, 10),
      durationMin: 120,
      isOnline: false,
      location: "渋谷エリアの屋内コート",
      joinUrl: null,
      speaker: null,
      tags: "ピックルボール,初心者歓迎",
      description: "持ち方・打ち方の基本から、2対2のゲームまで。パドルは貸し出しあり。動きやすい服装と室内シューズでどうぞ。終わったらランチ会です。",
      capacity: 16,
      clubId: clubs.pickleball.id,
    },
    {
      title: "ピックルボール部：ダブルス練習会",
      type: "部活",
      date: at(21, 10),
      durationMin: 120,
      isOnline: false,
      location: "品川エリアの屋内コート",
      joinUrl: null,
      speaker: null,
      tags: "ピックルボール",
      description: "ダブルスのゲームを中心に。経験者と未経験者でペアを組むので、初参加でも大丈夫です。",
      capacity: 16,
      clubId: clubs.pickleball.id,
    },
    {
      title: "筋トレ部：肩こり・腰痛予防の全身トレーニング",
      type: "部活",
      date: at(3, 19, 30),
      durationMin: 60,
      isOnline: false,
      location: "渋谷のパーソナルジム",
      joinUrl: null,
      speaker: null,
      tags: "筋トレ,初心者歓迎",
      description: "スクワット・ヒップリフト・ローイングなど、デスクワークで弱りやすい筋肉を中心に。フォームは部員のトレーナーがチェックします。",
      capacity: 10,
      clubId: clubs.training.id,
    },
    {
      title: "筋トレ部：自宅でできる30分トレーニング（オンライン）",
      type: "部活",
      date: at(1, 21),
      durationMin: 30,
      isOnline: true,
      location: "オンライン（Zoom）",
      joinUrl: "https://zoom.us/j/0000000003",
      speaker: null,
      tags: "筋トレ,オンライン",
      description: "道具なし・マット1枚でできるメニューを30分。カメラオフでもOKです。",
      capacity: 50,
      clubId: clubs.training.id,
    },
    {
      title: "フリーランス・SESエンジニア交流会（渋谷）",
      type: "交流会",
      date: at(16, 19),
      durationMin: 120,
      isOnline: false,
      location: "東京・渋谷",
      joinUrl: null,
      speaker: null,
      tags: "交流会",
      description: "独立している人も、これから考えている人も。案件の選び方やお金の話を気軽に聞ける会です。",
      capacity: 30,
    },
  ];
  const events = [];
  for (const e of eventsData) events.push(await prisma.event.create({ data: e }));

  // 青木さんは勉強会1件とランニング部の活動に申込済み（参加URLの発行を確認できる）
  await prisma.eventApplication.create({
    data: { userId: user.id, eventId: events[0].id, purpose: "現場でのAI活用を知りたい", level: "実務で少し" },
  });
  await prisma.eventApplication.create({ data: { userId: user.id, eventId: events[3].id } });

  // 健康ログ（直近10日分）と健康診断（14か月前 → リマインド対象）
  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i - 1);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const data = {
      steps: [3200, 8400, 2900, 4100, 11200, 3600, 2500, 7800, 3900, 5200][i],
      sleepHours: [6, 7, 5.5, 6.5, 7.5, 6, 5, 7, 6.5, 6][i],
      exerciseMin: [0, 30, 0, 10, 60, 0, 0, 25, 0, 15][i],
      mood: [3, 4, 2, 3, 5, 3, 2, 4, 3, 3][i],
    };
    await prisma.healthLog.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: data,
      create: { userId: user.id, date, ...data },
    });
  }
  const checkup = new Date();
  checkup.setMonth(checkup.getMonth() - 14);
  await prisma.user.update({ where: { id: user.id }, data: { lastCheckupDate: checkup } });

  // 資産形成プラン
  const plan = {
    monthlyLivingCost: 280000,
    cashSavings: 1200000,
    investedAssets: 800000,
    kyosaiMonthly: 20000,
    idecoMonthly: 0,
    nisaMonthly: 30000,
    expectedReturn: 0.03,
    retireAge: 65,
  };
  await prisma.wealthPlan.upsert({ where: { userId: user.id }, update: plan, create: { userId: user.id, ...plan } });

  // 運営アカウント
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { role: "admin" },
    create: { email: "admin@example.com", passwordHash, name: "運営 事務局", role: "admin" },
  });

  // 見込み客のサンプル（部活・勉強会から登録した人たち）
  const leadSeeds: { email: string; name: string; workStyle: string; source: string | null; clubs: string[]; days: number; referredBy?: string }[] = [
    { email: "sato@example.com", name: "佐藤 陸", workStyle: "ses_employee", source: "club:pickleball", clubs: ["pickleball"], days: 12 },
    { email: "kimura@example.com", name: "木村 葵", workStyle: "considering", source: "club:training", clubs: ["training", "pickleball"], days: 4 },
    { email: "ito@example.com", name: "伊藤 湊", workStyle: "freelance", source: "event", clubs: [], days: 20 },
    { email: "yamada@example.com", name: "山田 結衣", workStyle: "ses_employee", source: "club:training", clubs: ["training"], days: 35 },
    { email: "nakamura@example.com", name: "中村 蒼", workStyle: "considering", source: "referral", clubs: ["training"], days: 2, referredBy: user.id },
  ];
  for (const l of leadSeeds) {
    const createdAt = new Date(Date.now() - l.days * 86_400_000);
    const lead = await prisma.user.upsert({
      where: { email: l.email },
      update: { workStyle: l.workStyle, signupSource: l.source, referredById: l.referredBy ?? null },
      create: {
        email: l.email,
        passwordHash,
        name: l.name,
        workStyle: l.workStyle,
        signupSource: l.source,
        referredById: l.referredBy ?? null,
        createdAt,
        joinedAt: createdAt,
      },
    });
    for (const slug of l.clubs) {
      await prisma.clubMembership.upsert({
        where: { userId_clubId: { userId: lead.id, clubId: clubs[slug].id } },
        update: {},
        create: { userId: lead.id, clubId: clubs[slug].id },
      });
    }
  }
  const kimura = await prisma.user.findUniqueOrThrow({ where: { email: "kimura@example.com" } });
  await prisma.eventApplication.create({
    data: { userId: kimura.id, eventId: events[2].id, purpose: "独立前に単価の相場を知りたい", level: "実務でがっつり" },
  });
  await prisma.rateDiagnosis.deleteMany({ where: { userId: kimura.id } });
  await prisma.rateDiagnosis.create({
    data: { userId: kimura.id, primarySkill: "Java", role: "バックエンドエンジニア", yearsOfExperience: 6, monthlyRate: 550000, chainDepth: 3 },
  });

  console.log("シードデータ投入が完了しました。");
  console.log("デモログイン: tanaka@example.com / password123");
  console.log("運営ログイン: admin@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

#!/usr/bin/env tsx
/**
 * 기존 MDX 글에 내부 링크를 일괄 삽입하는 일회성 스크립트
 */
import fs from "fs";
import path from "path";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

interface LinkEdit {
  file: string;
  /** 이 텍스트 뒤에 링크 문장을 삽입 */
  after: string;
  /** 삽입할 링크 문장 */
  insert: string;
}

const edits: LinkEdit[] = [
  // ========== 방산/전쟁/중동 그룹 ==========
  // war-defense-stocks
  {
    file: "2026-03-19-war-defense-stocks.mdx",
    after: "시장에 미치는 영향 흐름을 간결하게 정리",
    insert: "\n\n드론 기반 전쟁 수행 방식의 변화에 대해서는 [미국 드론 전쟁 관련주 TOP 5 분석](/posts/2026-03-19-us-drone-war-stocks/)에서 상세히 다루었습니다.",
  },
  {
    file: "2026-03-19-war-defense-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n중동 지역의 에너지 공급 리스크가 궁금하시다면 [호르무즈 해협 봉쇄 유가 해운 관련주 TOP 6](/posts/2026-03-19-hormuz-oil-shipping-stocks/) 분석을 참고하세요. 종전 이후 재건 수혜주는 [중동전쟁 종전 건설주 관련주 TOP 7](/posts/2026-04-01-middle-east-war-construction/)에서 확인하실 수 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // us-drone-war-stocks
  {
    file: "2026-03-19-us-drone-war-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n전통 방산 분야의 투자 기회는 [전쟁 방산 관련주 TOP 6 분석](/posts/2026-03-19-war-defense-stocks/)에서 확인하세요. 중동 정세와 에너지 공급에 대해서는 [호르무즈 해협 봉쇄 유가 해운 관련주 TOP 6](/posts/2026-03-19-hormuz-oil-shipping-stocks/) 분석도 참고하시기 바랍니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // hormuz-oil-shipping-stocks
  {
    file: "2026-03-19-hormuz-oil-shipping-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n중동 분쟁과 방산주 수혜에 관심이 있다면 [전쟁 방산 관련주 TOP 6 분석](/posts/2026-03-19-war-defense-stocks/)을 참고하세요. 나프타 가격 상승이 산업에 미치는 영향은 [나프타 가격 급등 플라스틱 대란 관련주 TOP 5](/posts/2026-03-24-naphtha-plastic-stocks/)에서 다루고 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // middle-east-war-stocks (알루미늄)
  {
    file: "2026-03-31-middle-east-war-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n방산주 전반에 대한 분석은 [전쟁 방산 관련주 TOP 6](/posts/2026-03-19-war-defense-stocks/)에서, 중동 정세와 에너지 수급 영향은 [호르무즈 해협 봉쇄 유가 해운 관련주 TOP 6](/posts/2026-03-19-hormuz-oil-shipping-stocks/)에서 확인하세요. 종전 이후 재건 수혜주는 [중동전쟁 종전 건설주 관련주 TOP 7](/posts/2026-04-01-middle-east-war-construction/)에서 다루고 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // middle-east-war-construction (건설)
  {
    file: "2026-04-01-middle-east-war-construction.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n중동 분쟁이 비철금속에 미치는 영향은 [중동전쟁 알루미늄 관련주 TOP 6](/posts/2026-03-31-middle-east-war-stocks/)에서 분석했습니다. 방산 테마에 관심이 있다면 [전쟁 방산 관련주 TOP 6](/posts/2026-03-19-war-defense-stocks/)과 [미국 드론 전쟁 관련주 TOP 5](/posts/2026-03-19-us-drone-war-stocks/) 분석도 함께 참고하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },

  // ========== 광통신/반도체/AI 그룹 ==========
  // optical-communication-stocks
  {
    file: "2026-03-24-optical-communication-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n광통신과 밀접한 [광반도체 관련주 TOP 17](/posts/2026-03-25-optical-semiconductor-stocks/) 분석도 투자 판단에 참고하세요. 엔비디아의 광통신 투자 전략은 [엔비디아 광통신 실리콘 포토닉스 관련주 TOP 24](/posts/2026-04-01-nvidia-optical-communication-stocks/)에서, AI 반도체 전반은 [엔비디아 GTC 2026 관련주 TOP 6](/posts/2026-03-19-gtc-2026/)에서 확인하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // optical-semiconductor-stocks
  {
    file: "2026-03-25-optical-semiconductor-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n광통신 인프라 상용화에 대한 분석은 [광통신 상용화 관련주 TOP 5](/posts/2026-03-24-optical-communication-stocks/)에서 확인하세요. 엔비디아의 최근 광통신 투자는 [엔비디아 광통신 실리콘 포토닉스 관련주 TOP 24](/posts/2026-04-01-nvidia-optical-communication-stocks/)에서, 6G 통신장비 분야는 [AI 및 6G 통신장비 관련주 분석](/posts/2026-03-30-ai-6g/)에서 다루고 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // nvidia-optical-communication-stocks
  {
    file: "2026-04-01-nvidia-optical-communication-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n광통신 상용화 전반은 [광통신 상용화 관련주 TOP 5](/posts/2026-03-24-optical-communication-stocks/)에서, 광반도체 소자 분석은 [광반도체 관련주 TOP 17](/posts/2026-03-25-optical-semiconductor-stocks/)에서 확인하세요. 6G 인프라 투자에 관심이 있다면 [6G 상용화 관련주 분석](/posts/2026-03-19-6g/)도 참고하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // gtc-2026
  {
    file: "2026-03-19-gtc-2026.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\nAI 반도체의 핵심 연결 기술인 광통신 분야는 [광통신 상용화 관련주 TOP 5](/posts/2026-03-24-optical-communication-stocks/)에서, 광반도체 심층 분석은 [광반도체 관련주 TOP 17](/posts/2026-03-25-optical-semiconductor-stocks/)에서 확인하세요. 차세대 통신 기술은 [6G 상용화 관련주 분석](/posts/2026-03-19-6g/)도 참고하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },

  // ========== 나프타/에너지/전기차/6G/우주항공 그룹 ==========
  // naphtha-plastic-stocks
  {
    file: "2026-03-24-naphtha-plastic-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n나프타 가격 상승이 포장재 산업에 미치는 영향은 [나프타 수급 불안 포장재 관련주 TOP 7](/posts/2026-03-26-naphtha-packaging-stocks/)에서 분석했습니다. 중동 정세와 에너지 수급은 [호르무즈 해협 봉쇄 유가 해운 관련주 TOP 6](/posts/2026-03-19-hormuz-oil-shipping-stocks/)에서 확인하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // naphtha-packaging-stocks
  {
    file: "2026-03-26-naphtha-packaging-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n나프타 원가 급등의 근본 원인과 석유화학 관련주는 [나프타 가격 급등 플라스틱 대란 관련주 TOP 5](/posts/2026-03-24-naphtha-plastic-stocks/)에서 다루고 있습니다. 에너지 수급 불안의 배경은 [호르무즈 해협 봉쇄 유가 해운 관련주 TOP 6](/posts/2026-03-19-hormuz-oil-shipping-stocks/)에서 확인하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // renewable-energy-stocks
  {
    file: "2026-03-30-renewable-energy-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n신재생에너지와 연결된 [전기차 확대 수혜주 관련주 TOP 8](/posts/2026-03-30-ev-stocks/) 분석도 참고하세요. 에너지 수급 이슈는 [호르무즈 해협 봉쇄 유가 해운 관련주 TOP 6](/posts/2026-03-19-hormuz-oil-shipping-stocks/)에서 확인하실 수 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // ev-stocks
  {
    file: "2026-03-30-ev-stocks.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n전기차 충전 인프라와 연결된 [신재생에너지 전환 관련주 TOP 6](/posts/2026-03-30-renewable-energy-stocks/) 분석도 함께 참고하세요. AI 반도체와 자율주행 기술은 [엔비디아 GTC 2026 관련주 TOP 6](/posts/2026-03-19-gtc-2026/)에서 다루고 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // 6g
  {
    file: "2026-03-19-6g.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\nAI 수요에 따른 통신장비 업황은 [AI 및 6G 통신장비 관련주 분석](/posts/2026-03-30-ai-6g/)에서 상세히 다루었습니다. 6G 핵심 기술인 광통신은 [광통신 상용화 관련주 TOP 5](/posts/2026-03-24-optical-communication-stocks/)에서, 광반도체는 [광반도체 관련주 TOP 17](/posts/2026-03-25-optical-semiconductor-stocks/)에서 확인하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // ai-6g
  {
    file: "2026-03-30-ai-6g.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n6G 상용화 전반에 대한 분석은 [6G 상용화 관련주 TOP 7](/posts/2026-03-19-6g/)에서 확인하세요. 광통신 인프라는 [광통신 상용화 관련주 TOP 5](/posts/2026-03-24-optical-communication-stocks/)에서, 엔비디아 AI 전략은 [엔비디아 GTC 2026 관련주 TOP 6](/posts/2026-03-19-gtc-2026/)에서 다루고 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
  // spacex
  {
    file: "2026-03-19-x.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n위성 통신과 연결된 [6G 상용화 관련주 TOP 7](/posts/2026-03-19-6g/) 분석도 참고하세요. 방산 분야에 관심이 있다면 [전쟁 방산 관련주 TOP 6](/posts/2026-03-19-war-defense-stocks/)에서 확인하실 수 있습니다. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },

  // ========== 신규상장 + 건설 차트 그룹 ==========
  // 아이엠바이오로직스
  {
    file: "2026-03-20-post-y0dh88.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n같은 시기 의료기기 IPO인 [메쥬 상장 분석](/posts/2026-03-24-post-4f2tvt/)과 [리센스메디컬 상장 분석](/posts/2026-03-30-post-d7pzp7/)도 비교해보세요. 핀테크 IPO는 [한패스 상장 분석](/posts/2026-03-25-hanpass-new-listing/)에서 확인하세요. 다른 신규 상장주 분석은 [신규 상장주 전체 보기](/category/new-stocks/)에서 확인하세요.",
  },
  // 메쥬
  {
    file: "2026-03-24-post-4f2tvt.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n바이오 IPO인 [아이엠바이오로직스 상장 분석](/posts/2026-03-20-post-y0dh88/)과 냉각치료 의료기기 [리센스메디컬 상장 분석](/posts/2026-03-30-post-d7pzp7/)도 함께 비교해보세요. 핀테크 IPO는 [한패스 상장 분석](/posts/2026-03-25-hanpass-new-listing/)에서 확인하세요. 다른 신규 상장주 분석은 [신규 상장주 전체 보기](/category/new-stocks/)에서 확인하세요.",
  },
  // 한패스
  {
    file: "2026-03-25-hanpass-new-listing.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n같은 시기 바이오 IPO인 [아이엠바이오로직스 상장 분석](/posts/2026-03-20-post-y0dh88/)과 의료기기 [메쥬 상장 분석](/posts/2026-03-24-post-4f2tvt/), [리센스메디컬 상장 분석](/posts/2026-03-30-post-d7pzp7/)도 비교해보세요. 다른 신규 상장주 분석은 [신규 상장주 전체 보기](/category/new-stocks/)에서 확인하세요.",
  },
  // 리센스메디컬
  {
    file: "2026-03-30-post-d7pzp7.mdx",
    after: "투자의 책임은 투자자 본인에게 있습니다.",
    insert: "\n\n같은 시기 바이오 IPO인 [아이엠바이오로직스 상장 분석](/posts/2026-03-20-post-y0dh88/)과 의료기기 [메쥬 상장 분석](/posts/2026-03-24-post-4f2tvt/)도 비교해보세요. 핀테크 IPO는 [한패스 상장 분석](/posts/2026-03-25-hanpass-new-listing/)에서 확인하세요. 다른 신규 상장주 분석은 [신규 상장주 전체 보기](/category/new-stocks/)에서 확인하세요.",
  },
  // 대우건설
  {
    file: "2026-04-01-daewoo-ec-chart.mdx",
    after: "핵심 관전 포인트는 단 하나",
    insert: "\n\n중동 리스크 완화와 건설주 수혜 분석은 [중동전쟁 종전 건설주 관련주 TOP 7](/posts/2026-04-01-middle-east-war-construction/)에서, 방산주 흐름은 [전쟁 방산 관련주 TOP 6](/posts/2026-03-19-war-defense-stocks/)에서 확인하세요. 더 많은 테마주 분석은 [핫이슈 전체 보기](/category/hot-issues/)에서 확인하세요.",
  },
];

// ---------------------------------------------------------------------------
let editCount = 0;
let skipCount = 0;

for (const edit of edits) {
  const filePath = path.join(POSTS_DIR, edit.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ 파일 없음: ${edit.file}`);
    skipCount++;
    continue;
  }

  let content = fs.readFileSync(filePath, "utf-8");

  // 이미 삽입된 링크가 있는지 확인 (중복 방지)
  if (content.includes(edit.insert.trim().slice(0, 50))) {
    console.log(`⏭️ 이미 삽입됨: ${edit.file}`);
    skipCount++;
    continue;
  }

  const idx = content.indexOf(edit.after);
  if (idx === -1) {
    console.warn(`⚠️ 삽입 위치 못 찾음: ${edit.file} — "${edit.after.slice(0, 40)}..."`);
    skipCount++;
    continue;
  }

  // after 텍스트 뒤의 줄 끝에 삽입
  const insertPos = idx + edit.after.length;
  content = content.slice(0, insertPos) + edit.insert + content.slice(insertPos);
  fs.writeFileSync(filePath, content, "utf-8");
  editCount++;
  console.log(`✅ ${edit.file}`);
}

console.log(`\n✨ 완료: ${editCount}개 파일 수정, ${skipCount}개 건너뜀`);

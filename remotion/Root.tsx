import React from "react";
import { Composition } from "remotion";
import type { ShortsAssets } from "../scripts/shorts/types";
import { TestComposition } from "./Shorts/TestComposition";
import { Shorts } from "./Shorts/Shorts";
import { FPS, HEIGHT, WIDTH } from "./Shorts/theme";

const TEST_DURATION_FRAMES = 5 * FPS;

const stubAssets: ShortsAssets = {
  slug: "preview",
  audioSrc: "",
  scenes: [
    {
      type: "hook",
      narration: "오늘 이 종목 모르면 후회합니다",
      onScreenText: "다날 +30%",
      visualDirection: "",
      emphasisWords: ["+30%"],
      stockData: null,
      priceHistory: null,
      startFrame: 0,
      durationFrames: 90,
      ctaProps: null,
      tableRows: null,
      mainBusiness: null,
    },
    {
      type: "stock_card",
      narration: "스테이블코인 상한가",
      onScreenText: "스테이블코인 상한가",
      visualDirection: "",
      emphasisWords: ["상한가"],
      stockData: {
        name: "다날",
        code: null,
        currentPrice: 0,
        changePercent: 30,
        tradeAmount: "547억원",
      },
      priceHistory: null,
      startFrame: 90,
      durationFrames: 75,
      ctaProps: null,
    },
    {
      type: "cta",
      narration: "K주식핫이슈에서 풀버전 확인",
      onScreenText: "K주식핫이슈",
      visualDirection: "",
      emphasisWords: ["K주식핫이슈"],
      stockData: null,
      priceHistory: null,
      startFrame: 165,
      durationFrames: 90,
      ctaProps: {
        brandName: "K주식핫이슈",
        siteUrl: "kstockflow.com",
        arrowDirection: "to_profile_top_left",
      },
      tableRows: null,
      mainBusiness: null,
    },
    {
      type: "loop",
      narration: "그 외 특징주는 K주식 HotIssue에서 확인하세요",
      onScreenText: "그 외 오늘의 특징주",
      visualDirection: "",
      emphasisWords: [],
      stockData: null,
      priceHistory: null,
      startFrame: 255,
      durationFrames: 120,
      ctaProps: null,
      tableRows: [
        { name: "삼성E&A", changePercent: 12.58, sector: "에너지플랜트" },
        { name: "그린리소스", changePercent: 13.22, sector: "반도체소재" },
        { name: "심텍", changePercent: 9.99, sector: "PCB" },
      ],
      mainBusiness: null,
    },
  ],
  sfxCues: [],
  totalDurationSec: 11,
  headerTitle: "4월 6일 주목해야 할 종목",
  footerBrand: "K주식핫이슈",
  footerHint: "프로필 → 전체 분석",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Test"
        component={TestComposition}
        durationInFrames={TEST_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{}}
      />
      <Composition
        id="Shorts"
        component={Shorts}
        durationInFrames={11 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={stubAssets}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(
            30,
            (props.scenes ?? []).reduce((sum, s) => sum + (s.durationFrames || 0), 0),
          ),
        })}
      />
    </>
  );
};

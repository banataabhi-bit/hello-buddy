import { motion } from "motion/react";
import { useState } from "react";
import { GameModal } from "@/components/GameModal";
import { HERO_EPIC_IMAGE, HERO_LEGEND_IMAGE } from "@/lib/images";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/litdex";

const ArrowGreenLeft = () => (
  <svg
    viewBox="0 0 100 100"
    className="h-full w-full overflow-visible stroke-current text-[#CCFF00]"
    fill="none"
    strokeWidth="6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10,10 C 10,55 35,70 55,55 C 75,40 80,55 78,85" />
    <path d="M62,68 L78,88 L92,66" />
  </svg>
);

const CircularBadge = ({ onClick }: { onClick?: () => void }) => (
  <div
    onClick={onClick}
    className="relative flex h-28 w-28 rotate-12 cursor-pointer items-center justify-center rounded-full border-[3px] border-black/5 bg-[#CCFF00] shadow-xl transition-transform hover:scale-105 md:h-36 md:w-36"
  >
    <div className="absolute inset-1 animate-[spin_10s_linear_infinite]">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path
          id="circlePath"
          d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
          fill="none"
        />
        <text className="font-black uppercase" fill="black" fontSize="9.5" letterSpacing="0.5">
          <textPath
            href="#circlePath"
            startOffset="0%"
            textLength="226"
            lengthAdjust="spacing"
          >
            MINT A CHAMPION • MINT A CHAMPION •&nbsp;
          </textPath>
        </text>
      </svg>
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="h-9 w-9 stroke-current text-black"
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M50,18 L50,78" />
        <path d="M26,56 L50,80 L74,56" />
      </svg>
    </div>
  </div>
);

const HARD_SHADOW =
  "1px 1px 0 #001A99, 2px 2px 0 #001A99, 3px 3px 0 #001A99, 4px 4px 0 #001A99, 5px 5px 0 #001A99, 6px 6px 0 #001A99, 7px 7px 0 #001A99, 8px 8px 0 #001A99, 9px 9px 0 #001A99, 10px 10px 0 #001A99, 11px 11px 0 #001A99, 12px 12px 0 #001A99, 13px 13px 0 #001A99, 14px 14px 0 #001A99";

const NAV_LINKS: Array<[string, string, boolean?]> = [
  ["Champions", "#champions", false],
  ["My points", "#points", false],
  ["Levels", "/levels", false],
  ["Mint", "#mint", false],
  ["Game", "#game", true],
];

export const Component = ({ onMintClick }: { onMintClick?: () => void }) => {
  const { address, connect, connecting, hasWallet, disconnect, chainId } = useWallet();
  const onBase = chainId === 8453;
  const [gameOpen, setGameOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#0038FF] font-sans selection:bg-[#CCFF00] selection:text-black">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      <nav className="relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 md:px-10 md:py-8">
        <div className="flex items-center gap-1">
          <img
            src="/favicon-512x512.png"
            alt="Litdex logo"
            className="h-8 w-8 rounded-lg shadow-sm md:h-10 md:w-10"
          />
          <div className="relative rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-xs font-black tracking-tight text-black shadow-sm md:text-sm">
            {onBase ? "BASE" : "LITDEX"}
            <div
              className="absolute -bottom-1.5 left-0 h-3 w-3 bg-white"
              style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
            ></div>
          </div>
          <div className="rounded-full border-[1.5px] border-white bg-[#CCFF00] px-3 py-1.5 text-xs font-black text-black shadow-sm md:text-sm">
            {onBase ? "MAINNET" : "TESTNET"}
          </div>
        </div>

        <div className="hidden items-center space-x-2 md:flex">
          {NAV_LINKS.map(([item, href, isGame]) =>
            isGame ? (
              <button
                key={item}
                onClick={() => setGameOpen(true)}
                className="btn fx-9 btn-pill btn-ghost nav-link"
              >
                <span className="btn-label">{item}</span>
              </button>
            ) : (
              <a
                key={item}
                href={href}
                className="btn fx-9 btn-pill btn-ghost nav-link"
              >
                <span className="btn-label">{item}</span>
              </a>
            )
          )}
        </div>

        {address ? (
          <button
            onClick={disconnect}
            className="btn fx-9 btn-pill btn-white"
          >
            <span className="btn-label">{truncateAddress(address)}</span>
          </button>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={connecting}
            className="btn fx-9 btn-pill btn-ghost"
          >
            <span className="btn-label">{connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "Install wallet"}</span>
          </button>
        )}
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center px-4 pt-8 pb-32 md:pt-12 md:pb-48">
        <div className="relative z-10 mx-auto mt-4 mb-16 flex w-full max-w-5xl flex-col items-center justify-center text-center">
          <div className="relative z-10 flex w-full flex-col items-center space-y-2 md:space-y-4">
            <div className="relative z-30 flex w-full justify-start pl-[10%] md:pl-[25%]">
              <h1
                className="m-0 p-0 text-[clamp(4.5rem,12vw,160px)] leading-[0.85] font-black tracking-tighter text-[#CCFF00] uppercase"
                style={{ fontFamily: '"Arial Black", Impact, sans-serif', textShadow: HARD_SHADOW }}
              >
                #LITDEX
              </h1>
            </div>

            <div className="relative z-20 flex w-full justify-center">
              <h1
                className="m-0 p-0 text-[clamp(5rem,15vw,220px)] leading-[0.85] font-black tracking-tighter text-white uppercase"
                style={{ fontFamily: '"Arial Black", Impact, sans-serif', textShadow: HARD_SHADOW }}
              >
                CHAMPIONS
              </h1>
            </div>

            <div className="relative z-10 flex w-full justify-start pl-[15%] md:pl-[30%]">
              <h1
                className="m-0 p-0 text-[clamp(4.5rem,12vw,160px)] leading-[0.85] font-black tracking-tighter text-white uppercase"
                style={{ fontFamily: '"Arial Black", Impact, sans-serif', textShadow: HARD_SHADOW }}
              >
                RISE
              </h1>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 h-full w-full">
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-auto absolute bottom-[10%] left-[5%] z-30 md:left-[20%]"
            >
              <div className="aspect-square w-40 rotate-[-12deg] overflow-hidden rounded-[2rem] border border-white/40 bg-white/20 shadow-2xl transition-transform duration-500 hover:rotate-0 md:w-52">
                <img
                  src={HERO_EPIC_IMAGE}
                  alt="Litdex Epic champion board pass"
                  loading="lazy"
                  width={1254}
                  height={1254}
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="pointer-events-auto absolute top-[34%] right-[2%] z-30 md:top-[32%] md:right-[18%]"
            >
              <div className="aspect-square w-40 rotate-[12deg] overflow-hidden rounded-[2rem] border border-white/40 bg-white/20 shadow-2xl transition-transform duration-500 hover:rotate-0 md:w-52">
                <img
                  src={HERO_LEGEND_IMAGE}
                  alt="Litdex Legend champion board pass"
                  loading="lazy"
                  width={1254}
                  height={1254}
                  className="h-full w-full object-cover"
                />
              </div>
            </motion.div>

            <div className="absolute bottom-[0%] left-[0%] z-20 h-24 w-24 md:left-[10%] md:h-32 md:w-32">
              <ArrowGreenLeft />
            </div>

            <div className="pointer-events-auto absolute right-[0%] bottom-[-10%] z-40 md:right-[15%]">
              {onMintClick ? <CircularBadge onClick={onMintClick} /> : <CircularBadge />}
            </div>
          </div>
        </div>
      </main>

      <GameModal open={gameOpen} onOpenChange={setGameOpen} />
    </div>
  );
};

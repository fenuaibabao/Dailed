import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LogoMark } from "@/components/brand/Logo";
import { LANDING, type LandingExample, type LandingStep } from "@/config/landing";
import type { ProductConfig } from "@/config/products";
import { SIGN_IN_PATH, SIGN_UP_PATH, withProduct } from "@/lib/routes";

const SECTION = "mx-auto box-border max-w-[1200px] px-4 md:px-8";
const H2 = "m-0 text-[clamp(28px,4vw,40px)] font-semibold leading-[1.15] tracking-[-0.025em]";

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

const TRUST_ICONS = [MicIcon, LockIcon, CheckIcon];

/** The logo with the product's short name beside it, e.g. "Warpwork Create". */
function ProductMark({ shortName, size = 26 }: { shortName: string | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-semibold tracking-[-0.02em]" style={{ fontSize: Math.round(size * 0.77) }}>
        {BRAND.name}
      </span>{" "}
      {shortName && (
        <span className="text-muted" style={{ fontSize: Math.round(size * 0.77) }}>
          {shortName}
        </span>
      )}
    </span>
  );
}

function Steps({ steps }: { steps: LandingStep[] }) {
  return (
    <section id="how" aria-labelledby="how-h" className={`${SECTION} flex flex-col gap-6 pb-[clamp(56px,8vw,96px)]`}>
      <p className="eyebrow">How it works</p>
      <h2 id="how-h" className={H2}>
        Three steps. You only do the talking.
      </h2>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4 p-0">
        {steps.map((step, i) => (
          <li key={step.title} className="card flex flex-col gap-2.5 rounded-[18px] p-[26px]">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-semibold text-white"
            >
              {i + 1}
            </span>
            <h3 className="m-0 text-[21px] font-semibold">{step.title}</h3>
            <p className="m-0 text-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Example({ example }: { example: LandingExample }) {
  return (
    <section aria-labelledby="ex-h" className={`${SECTION} flex flex-col gap-6 pb-[clamp(56px,8vw,96px)]`}>
      <p className="eyebrow">An example</p>
      <h2 id="ex-h" className={H2}>
        {example.heading}
      </h2>
      <div className="flex flex-wrap items-stretch gap-5">
        <figure className="m-0 flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 rounded-[18px] bg-ink p-7 text-surface-2">
          <figcaption className="eyebrow text-ink-muted">You said</figcaption>
          <blockquote className="m-0 text-[clamp(22px,3vw,28px)] font-medium leading-[1.35] text-white">
            {example.said}
          </blockquote>
        </figure>
        <div className="card flex min-w-0 flex-[1.4_1_380px] flex-col gap-3.5 rounded-[18px] p-7">
          <div className="flex flex-wrap justify-between gap-3 text-[13px]">
            <span className="tag">{example.outputLabel}</span>
            <span className="text-muted">Built only from what you said</span>
          </div>
          {example.outputTitle && <h3 className="m-0 text-[21px] font-semibold">{example.outputTitle}</h3>}
          {typeof example.output === "string" ? (
            <p className="m-0 whitespace-pre-line text-[17px] leading-[1.65]">{example.output}</p>
          ) : (
            <dl className="m-0 flex flex-col gap-3.5">
              {example.output.map((part) => (
                <div key={part.label} className="flex flex-col gap-1">
                  <dt className="eyebrow">{part.label}</dt>
                  <dd className="m-0 text-[16px] leading-[1.6] text-soft">{part.body}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function Trust({ items }: { items: LandingStep[] }) {
  return (
    <section aria-labelledby="trust-h" className="bg-ink text-surface-2">
      <div className={`${SECTION} flex flex-col gap-8 py-[clamp(48px,7vw,80px)]`}>
        <h2 id="trust-h" className={`${H2} text-white`}>
          Plain about how it works
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-7 p-0">
          {items.map((item, i) => {
            const Icon = TRUST_ICONS[i % TRUST_ICONS.length];
            return (
              <li key={item.title} className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink-raised text-white">
                  <Icon />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[17px] font-semibold text-white">{item.title}</span>
                  <span className="text-[15px] text-ink-text">{item.body}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * A product's landing page, from one template. The product chosen here
 * carries through sign-up to the session page.
 */
export function ProductLanding({ product }: { product: ProductConfig }) {
  const copy = product.enabled ? LANDING[product.slug] : undefined;
  const shortName = copy?.shortName ?? product.name.replace(`${BRAND.name} `, "");
  const home = product.slug === "create" ? "/" : `/${product.slug}`;

  return (
    <div className="text-base leading-[1.55]">
      <header className={`${SECTION} flex flex-wrap items-center justify-between gap-3 py-[18px]`}>
        <Link href={home} className="text-foreground no-underline hover:text-foreground">
          <ProductMark shortName={shortName} />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 text-[15px]">
          {copy && (
            <a href="#how" className="flex min-h-11 items-center px-2.5 text-soft no-underline hover:text-foreground">
              How it works
            </a>
          )}
          {product.enabled && (
            <Link href={withProduct(SIGN_IN_PATH, product.slug)} className="flex min-h-11 items-center px-2.5 font-medium">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main>
        <section className={`${SECTION} flex flex-col gap-6 pt-[clamp(40px,8vw,96px)] pb-[clamp(48px,8vw,88px)]`}>
          <p className="eyebrow">{copy?.eyebrow ?? product.audience}</p>
          <h1 className="m-0 max-w-[960px] text-[clamp(40px,7vw,76px)] font-semibold leading-[1.02] tracking-[-0.035em]">
            {copy?.title ?? product.headline}
          </h1>
          {copy && <p className="m-0 max-w-[700px] text-[clamp(18px,2.2vw,22px)] text-soft">{copy.intro}</p>}
          {product.enabled ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-2">
              <Link
                href={withProduct(SIGN_UP_PATH, product.slug)}
                className="btn btn-primary btn-lg min-h-[60px] rounded-2xl px-8 text-lg"
              >
                <MicIcon />
                Start talking
              </Link>
              <span className="text-[15px] text-muted">Works in your browser. Just bring a microphone.</span>
            </div>
          ) : (
            <p className="notice self-start text-base" data-testid="coming-soon">
              Coming soon.
            </p>
          )}
          {product.disclaimer && (
            <p className="m-0 max-w-[700px] text-[15px] text-muted" data-testid="product-disclaimer">
              {product.disclaimer}
            </p>
          )}
        </section>

        {copy && <Steps steps={copy.steps} />}
        {copy?.example && <Example example={copy.example} />}
        {copy && <Trust items={copy.trust} />}
      </main>

      <footer className="border-t border-border">
        <div className={`${SECTION} flex flex-wrap items-center justify-between gap-5 pt-8 pb-10 text-sm text-muted`}>
          <span className="text-foreground">
            <ProductMark shortName={shortName} size={20} />
          </span>
          <span>© {new Date().getFullYear()} {BRAND.name} (working name)</span>
        </div>
      </footer>
    </div>
  );
}

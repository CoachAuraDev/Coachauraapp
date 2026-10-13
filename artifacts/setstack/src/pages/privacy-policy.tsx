import { useEffect } from "react";

const canonicalUrl = "https://set-stack-trainer-hub--zacpratley.replit.app/privacy-policy";
const pageTitle = "Privacy Policy — CoachAura Client Tracker";
const description = "Plain-language privacy policy for CoachAura – Client Tracker, covering local storage, exports, third-party services and your responsibilities.";
const openGraphDescription = "How CoachAura stores client information, how exports work, and what trainers should know.";

function updateHeadTag(selector: string, tagName: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLElement>(selector);
  const created = !element;
  if (!element) {
    element = document.createElement(tagName);
    document.head.appendChild(element);
  }
  const previous = Object.fromEntries(
    Object.keys(attributes).map((name) => [name, element!.getAttribute(name)]),
  );
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return () => {
    if (created) {
      element?.remove();
      return;
    }
    for (const [name, value] of Object.entries(previous)) {
      if (value === null) element?.removeAttribute(name);
      else element?.setAttribute(name, value);
    }
  };
}

export default function PrivacyPolicyPage() {
  useEffect(() => {
    const oldTitle = document.title;
    document.title = pageTitle;
    const cleanup = [
      updateHeadTag('meta[name="description"]', "meta", { name: "description", content: description }),
      updateHeadTag('link[rel="canonical"]', "link", { rel: "canonical", href: canonicalUrl }),
      updateHeadTag('meta[property="og:url"]', "meta", { property: "og:url", content: canonicalUrl }),
      updateHeadTag('meta[property="og:type"]', "meta", { property: "og:type", content: "article" }),
      updateHeadTag('meta[property="og:title"]', "meta", { property: "og:title", content: pageTitle }),
      updateHeadTag('meta[property="og:description"]', "meta", { property: "og:description", content: openGraphDescription }),
    ];
    return () => {
      document.title = oldTitle;
      cleanup.forEach((restore) => restore());
    };
  }, []);

  return (
    <div className="privacy-policy-page">
      <style>{`
        .privacy-policy-page {
          --pp-page: #0B0B0D; --pp-surface: #17171B; --pp-ink: #F5F5F7;
          --pp-body: #A1A1AA; --pp-muted: #A1A1AA; --pp-rule: #303036;
          --pp-lime: #B7F34A; --pp-lime-dim: #273119;
          min-height: 100dvh; background: radial-gradient(ellipse at 50% -20%, rgba(183,243,74,.075), transparent 38rem), var(--pp-page);
          color: var(--pp-body); font: 16px/1.72 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
        }
        .privacy-policy-page *, .privacy-policy-page *::before, .privacy-policy-page *::after { box-sizing: border-box; }
        .privacy-policy-page a { color: var(--pp-lime); text-underline-offset: .22em; }
        .privacy-policy-page a:hover { color: #e0f9a5; }
        .privacy-policy-page a:focus-visible { outline: 2px solid var(--pp-lime); outline-offset: 4px; border-radius: 2px; }
        .privacy-policy-page .pp-shell { width: min(790px, calc(100% - 40px)); margin-inline: auto; }
        .privacy-policy-page .pp-masthead { display:flex; align-items:center; justify-content:space-between; padding:28px 0 25px; border-bottom:1px solid var(--pp-rule); }
        .privacy-policy-page .pp-brand { display:inline-flex; gap:11px; align-items:center; color:var(--pp-ink); text-decoration:none; }
        .privacy-policy-page .pp-mark { display:grid; place-items:center; width:32px; height:32px; border:1px solid rgba(183,243,74,.48); border-radius:9px; background:var(--pp-lime-dim); color:var(--pp-lime); }
        .privacy-policy-page .pp-mark svg { display:block; }
        .privacy-policy-page .pp-brand-name { font-size:15px; font-weight:680; letter-spacing:-.035em; }
        .privacy-policy-page .pp-product { margin-left:2px; color:var(--pp-muted); font-size:13px; font-weight:450; }
        .privacy-policy-page .pp-top-note { color:var(--pp-muted); font-size:12px; letter-spacing:.08em; text-transform:uppercase; }
        .privacy-policy-page main { padding:74px 0 100px; }
        .privacy-policy-page .pp-eyebrow { display:flex; align-items:center; gap:10px; margin:0 0 17px; color:var(--pp-lime); font-size:12px; font-weight:650; letter-spacing:.14em; text-transform:uppercase; }
        .privacy-policy-page .pp-eyebrow::before { width:22px; height:1px; background:var(--pp-lime); content:""; }
        .privacy-policy-page h1 { max-width:660px; margin:0; color:var(--pp-ink); font-size:clamp(42px,8vw,66px); line-height:1.04; letter-spacing:-.065em; font-weight:650; }
        .privacy-policy-page .pp-intro { max-width:630px; margin:23px 0 0; color:#D4D4D8; font-size:18px; line-height:1.65; }
        .privacy-policy-page .pp-effective { display:inline-flex; align-items:center; gap:9px; margin-top:25px; padding:8px 12px; border:1px solid var(--pp-rule); border-radius:999px; background:rgba(255,255,255,.018); color:var(--pp-muted); font-size:13px; }
        .privacy-policy-page .pp-effective::before { width:6px; height:6px; border-radius:50%; background:var(--pp-lime); content:""; }
        .privacy-policy-page .pp-summary { display:grid; grid-template-columns:34px 1fr; gap:15px; margin:49px 0 52px; padding:20px 22px; border:1px solid var(--pp-rule); border-radius:12px; background:var(--pp-surface); }
        .privacy-policy-page .pp-summary-mark { color:var(--pp-lime); font-size:18px; line-height:1.5; font-weight:700; }
        .privacy-policy-page .pp-summary p { margin:0; color:#D4D4D8; font-size:14px; line-height:1.7; }
        .privacy-policy-page .pp-summary strong { color:var(--pp-ink); font-weight:620; }
        .privacy-policy-page .pp-contents { display:flex; flex-wrap:wrap; gap:8px; padding:0 0 33px; border-bottom:1px solid var(--pp-rule); margin-bottom:14px; }
        .privacy-policy-page .pp-contents-label { width:100%; margin:0 0 4px; color:var(--pp-muted); font-size:11px; font-weight:650; letter-spacing:.12em; text-transform:uppercase; }
        .privacy-policy-page .pp-contents a { padding:6px 10px; border:1px solid var(--pp-rule); border-radius:6px; color:#D4D4D8; text-decoration:none; font-size:12px; line-height:1.4; transition:color .16s ease,border-color .16s ease,background .16s ease; }
        .privacy-policy-page .pp-contents a:hover { color:var(--pp-lime); border-color:#647344; background:var(--pp-lime-dim); }
        .privacy-policy-page article section { padding:28px 0 29px; border-bottom:1px solid var(--pp-rule); scroll-margin-top:24px; }
        .privacy-policy-page h2 { margin:0 0 13px; color:var(--pp-ink); font-size:21px; line-height:1.3; letter-spacing:-.035em; font-weight:620; }
        .privacy-policy-page p { margin:0 0 13px; }
        .privacy-policy-page p:last-child { margin-bottom:0; }
        .privacy-policy-page ul { margin:10px 0 14px; padding-left:21px; }
        .privacy-policy-page li { margin:6px 0; padding-left:3px; }
        .privacy-policy-page li::marker { color:var(--pp-lime); }
        .privacy-policy-page .pp-key { color:#E4E4E7; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.92em; overflow-wrap:anywhere; }
        .privacy-policy-page .pp-contact { margin-top:20px; padding:19px 20px; border:1px solid var(--pp-rule); border-radius:10px; background:var(--pp-surface); }
        .privacy-policy-page .pp-contact p + p { margin-top:8px; }
        .privacy-policy-page footer { display:flex; justify-content:space-between; gap:16px; align-items:center; padding:25px 0 32px; color:var(--pp-muted); font-size:12px; }
        .privacy-policy-page footer span:last-child { color:#71717A; }
        @media (max-width:560px) {
          .privacy-policy-page .pp-shell { width:min(100% - 32px,790px); }
          .privacy-policy-page .pp-masthead { padding:20px 0; }
          .privacy-policy-page .pp-top-note { display:none; }
          .privacy-policy-page .pp-product { font-size:12px; }
          .privacy-policy-page main { padding:53px 0 66px; }
          .privacy-policy-page .pp-intro { font-size:16px; }
          .privacy-policy-page .pp-summary { margin:37px 0 40px; padding:17px; }
          .privacy-policy-page article section { padding:24px 0; }
          .privacy-policy-page h2 { font-size:19px; }
          .privacy-policy-page footer { align-items:flex-start; flex-direction:column; }
        }
        @media (prefers-reduced-motion:reduce) {
          .privacy-policy-page .pp-contents a { transition-duration:.01ms; }
        }
      `}</style>
      <div className="pp-shell">
        <header className="pp-masthead">
          <a className="pp-brand" href="/privacy-policy" aria-label="CoachAura privacy policy">
            <span className="pp-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 6.1h2.2v5.8H3zM12.8 6.1H15v5.8h-2.2zM5.2 8.1h7.6v1.8H5.2zM1.4 7.2H3v3.6H1.4zM15 7.2h1.6v3.6H15z" fill="currentColor"/>
              </svg>
            </span>
            <span className="pp-brand-name">CoachAura<span className="pp-product"> / Client Tracker</span></span>
          </a>
          <span className="pp-top-note">Privacy &amp; data</span>
        </header>
        <main>
          <p className="pp-eyebrow">Privacy policy</p>
          <h1>Your clients’ details stay in your hands.</h1>
          <p className="pp-intro">This notice explains how CoachAura – Client Tracker handles information used to manage clients and training. It is written for trainers who use the app and the people whose information they record.</p>
          <p className="pp-effective">Effective October 13, 2026</p>
          <aside className="pp-summary" aria-label="Summary">
            <span className="pp-summary-mark" aria-hidden="true">↳</span>
            <p><strong>In brief:</strong> CoachAura saves working records in local browser or Android WebView storage. Browser and Android data are separate. You can export a JSON backup, but exported files are not encrypted by CoachAura. Keep your device and any copies secure.</p>
          </aside>
          <nav className="pp-contents" aria-label="On this page">
            <p className="pp-contents-label">On this page</p>
            <a href="#information">Information in the app</a><a href="#storage">Storage and deletion</a>
            <a href="#sharing">Exports and sharing</a><a href="#services">Third-party services</a>
            <a href="#security">Security and responsibility</a><a href="#rights">Privacy rights</a>
            <a href="#changes">Changes and contact</a>
          </nav>
          <article>
            <section id="information">
              <h2>1. Information entered into CoachAura</h2>
              <p>CoachAura lets a trainer keep client profiles and notes, measurements, bodyweight entries, routines, workout records and completed sessions. It also saves app preferences such as units, custom exercises, reusable templates and an unfinished workout draft. The information in a client record may be personal or sensitive depending on what the trainer chooses to enter.</p>
              <p>CoachAura does not require a client account for these local records. Trainers should only enter information they have an appropriate reason and permission to keep, and should avoid recording details that are not needed for their coaching relationship.</p>
            </section>
            <section id="storage">
              <h2>2. Where information is stored</h2>
              <p>The app stores its working data on the device or browser where it is used. In a browser, CoachAura uses browser local storage under the legacy key <span className="pp-key">setstack-v1</span>. In the Android app, data is kept in that app’s WebView storage. Browser storage and Android app storage are separate and do not sync with each other.</p>
              <p>Client data remains in local browser or WebView storage until the trainer deletes it, the storage is cleared, or the app is uninstalled. Deleting a client in the app also removes that client’s sessions, routines and measurements from the app’s local records. Reinstalling, clearing storage, device failure or loss can affect locally stored data.</p>
              <p>Android automatic app backup is disabled for CoachAura. Changing the Android app’s package ID creates a separate app storage area; existing data is not automatically copied into that separate installation.</p>
            </section>
            <section id="sharing">
              <h2>3. Backups, exports and sharing</h2>
              <p>You can export a JSON backup to a destination you choose. The exported file can include client records and related training information, preferences, custom exercises, templates and an unfinished workout. CoachAura does not encrypt these backup files.</p>
              <p>On Android, the app can share files using Android’s sharing features. A shared file may be delivered to a service, app or person you select. Exported or shared copies are outside CoachAura’s local app storage: they remain at the chosen destination until you remove them there. Anyone who can access an exported file may be able to read its contents.</p>
              <p>Choose a trusted destination, protect the file, and check that it has been saved where you intended. Dismissing a share sheet does not necessarily create a permanent backup.</p>
            </section>
            <section id="services">
              <h2>4. Services involved in app operation</h2>
              <p>The app’s frontend source does not show server synchronization, user sign-in, an analytics SDK or app-backend requests. This describes the implementation reviewed; it is not a guarantee that no information is ever transmitted. Device, operating-system, network, hosting and platform behavior may also apply.</p>
              <ul>
                <li><strong>Google Play Billing (Android):</strong> used to retrieve product details and purchase state. Google Play handles this interaction under its own privacy practices.</li>
                <li><strong>Google Fonts (website):</strong> CoachAura’s web app loads typography resources from Google Fonts. Google may process request-related information under its own privacy practices.</li>
                <li><strong>Hosting:</strong> Replit hosts this public policy page and may process technical request information to serve and protect the site.</li>
                <li><strong>Sharing destinations:</strong> when you choose to share or save a file, the selected app or destination handles it under its own terms and privacy practices.</li>
              </ul>
              <p>These providers and destinations have their own privacy notices and practices. CoachAura does not control how they handle information.</p>
            </section>
            <section id="security">
              <h2>5. Security and trainer responsibilities</h2>
              <p>Local storage means client records may be accessible to someone with access to the device, browser profile or unlocked app environment. CoachAura does not provide app-level encryption for its local records or exported backups. Use device-level security, limit access to your devices, and store backup files carefully.</p>
              <p>Trainers are responsible for handling client information lawfully, giving any notices that are required, obtaining any necessary permissions, responding to client requests, and following applicable retention and security requirements. This policy is not a statement that the app or its users comply with any particular law.</p>
            </section>
            <section id="rights">
              <h2>6. Client requests and privacy rights</h2>
              <p>Privacy rights depend on where a person lives and the circumstances. Where applicable law provides rights to access, correct, delete or receive a copy of information, clients should contact the trainer who entered their information. The trainer controls the locally held record and can review, correct, delete or export that copy in CoachAura, subject to applicable law.</p>
              <p>A trainer’s local copy is distinct from any exported backup or shared copy. Those copies may need to be located and removed separately from the destination where they were saved.</p>
              <p>For app or policy questions, contact the developer using the details below. Developer support is not a substitute for the trainer’s responsibilities toward their clients.</p>
            </section>
            <section id="changes">
              <h2>7. Changes and contact</h2>
              <p>This policy may be updated when the app or its practices change. The effective date at the top indicates when this version applies. Please review the policy again after a significant update.</p>
              <div className="pp-contact">
                <p><strong>Developer or business:</strong> CoachAura</p>
                <p><strong>Support:</strong> coachauradev@protonmail.com</p>
                <p>Use this contact for app and privacy-policy questions. For a request about information a trainer entered, contact that trainer directly.</p>
              </div>
            </section>
          </article>
        </main>
        <footer><span>CoachAura — Client Tracker</span><span>Privacy policy · Effective October 13, 2026</span></footer>
      </div>
    </div>
  );
}

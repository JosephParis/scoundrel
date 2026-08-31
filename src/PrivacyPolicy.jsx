import { Link } from 'react-router-dom'
import { PRIVACY_CONTACT } from './privacyContact'

/**
 * Plain-language privacy policy (issue 06).
 *
 * Required because the game takes Google sign-in, stores an email address
 * server-side, and sends data to three third-party processors. Google's Identity
 * Services terms also expect an app using them to publish one.
 *
 * Kept deliberately specific: every processor is named, and the parts that are
 * genuinely private are stated as plainly as the parts that are not. If the
 * behaviour described here changes, this page has to change with it -- a policy
 * that has drifted from the code is worse than none.
 */

// Last substantive change to what this page describes. Update it whenever the
// data handling changes, not on every unrelated edit.
const LAST_UPDATED = '29 July 2026'

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="font-display text-rune text-lg mb-2">{title}</h2>
      <div className="text-[14px] text-slate-300 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function Row({ what, why, who }) {
  return (
    <tr className="border-t border-stone-800 align-top">
      <td className="py-2 pr-4 text-parchment">{what}</td>
      <td className="py-2 pr-4">{why}</td>
      <td className="py-2 text-slate-400">{who}</td>
    </tr>
  )
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-dvh bg-dungeon text-parchment px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-[12px] text-slate-500 hover:text-rune transition">
          &larr; Back to the game
        </Link>

        <h1 className="font-display text-rune text-3xl mt-4 mb-1">Privacy</h1>
        <p className="text-[12px] text-slate-500 mb-8">Last updated {LAST_UPDATED}</p>

        <Section title="The short version">
          <p>
            Sigil is a small game made by one person. You can play the whole thing
            without signing in or giving me anything at all. If you do sign in, it is so
            your runs follow you between devices.
          </p>
          <p>
            Nothing you do here is sold, and nothing is shared with advertisers. Your name
            only ever appears publicly if you type one into Settings yourself.
          </p>
        </Section>

        <Section title="Playing without an account">
          <p>
            No sign-in is required. Guest play stores your run entirely in your own
            browser. Finished runs are sent to my database as anonymous gameplay records
            under the id <span className="font-mono text-slate-400">guest</span>, which
            identifies no one, so I can see how the game is balanced.
          </p>
        </Section>

        <Section title="What is collected if you sign in">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">What</th>
                  <th className="pb-2 pr-4 font-medium">Why</th>
                  <th className="pb-2 font-medium">Who holds it</th>
                </tr>
              </thead>
              <tbody>
                <Row
                  what="Google account id"
                  why="Ties your saves and run history together across devices."
                  who="Neon, PostHog, Vercel"
                />
                <Row
                  what="Email address"
                  why="Recorded with your profile so I can identify an account if you contact me about it."
                  who="Neon only"
                />
                <Row
                  what="Gameplay records"
                  why="Balance: how often runs are won, where players die, which boons are picked."
                  who="Neon, PostHog"
                />
                <Row
                  what="A random device id"
                  why="Stored with your runs so the leaderboard can tell two signed-out players apart without using their names. Random, created on this device, and never shown to anyone — not even to you."
                  who="Neon only"
                />
                <Row
                  what="Leaderboard name"
                  why="Shown publicly on the fastest-victory board. A random name like 'Ashen Vagrant 47' is assigned to your device unless you set your own, and you can ask in Settings not to be named at all."
                  who="Neon (and anyone viewing the board)"
                />
                <Row
                  what="Feedback you send"
                  why="So I can read and act on it. Includes what was happening in your run."
                  who="Neon only"
                />
                <Row
                  what="Page performance and usage"
                  why="Finding crashes, slow loads, and screens people get stuck on."
                  who="PostHog, Vercel"
                />
              </tbody>
            </table>
          </div>
          <p>
            Your Google password is never involved: sign-in happens on Google&rsquo;s side
            and I only receive a token confirming it worked.
          </p>
        </Section>

        <Section title="Who processes it">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="text-parchment">Google</span> &mdash; sign-in only, via
              Google Identity Services. Also serves the fonts this page uses, which means
              Google sees your IP address when the page loads.
            </li>
            <li>
              <span className="text-parchment">Neon</span> &mdash; the Postgres database
              holding saves, run records, leaderboard entries and feedback.
            </li>
            <li>
              <span className="text-parchment">PostHog</span> &mdash; product analytics.
              It receives your Google account id and gameplay events, but{' '}
              <span className="text-parchment">not your email address or your name</span>.
              Alongside the id it stores a made-up label such as
              &ldquo;Ashen Vagrant 47&rdquo;, derived from the id so I can tell sessions
              apart without knowing who anyone is.
            </li>
            <li>
              <span className="text-parchment">Vercel</span> &mdash; hosting, plus its
              Analytics and Speed Insights, which record page views and load timings.
            </li>
          </ul>
        </Section>

        <Section title="What is public">
          <p>
            Only one thing: an entry on the fastest-victory leaderboard, listing the time,
            mode and ascension of a winning run. Every victory that qualifies is listed,
            and it carries a name.
          </p>
          <p>
            That name is one of three things. By default it is a random one picked for
            your device the first time you play &mdash; something like &ldquo;Ashen Vagrant
            47&rdquo; &mdash; which is generated from a random id and says nothing about
            who you are. If you set your own name in Settings, or on the victory screen,
            the entry carries that instead. And if you tick &ldquo;don&rsquo;t list a
            name&rdquo; in Settings, the entry carries none and reads
            &ldquo;Anonymous&rdquo;. The run is listed either way; only the name changes.
          </p>
          <p>
            No name is ever taken from your Google profile for this, and the leaderboard
            deliberately strips account ids and device ids before sending anything to your
            browser, so one player can never learn another&rsquo;s.
          </p>
          <p>
            If you play without signing in, your runs carry a random id created on this
            device. It exists so the board can tell you apart from other signed-out
            players &mdash; without it, two people who happen to share a name are treated
            as one, and the slower run is dropped. It is generated from nothing but chance,
            is never displayed, and is not sent to anyone viewing the board. Clearing your
            browser storage discards it, and your next run counts as a new player.
          </p>
        </Section>

        <Section title="How long it is kept">
          <p>
            Saves and run history are kept while the account exists, because that history
            is the point of signing in. Gameplay records are kept indefinitely as
            balance data. Analytics data follows the providers&rsquo; own retention.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Email{' '}
            <a
              href={`mailto:${PRIVACY_CONTACT}?subject=Sigil%20data%20deletion`}
              className="text-rune hover:underline font-mono text-[13px]"
            >
              {PRIVACY_CONTACT}
            </a>{' '}
            and I will delete your profile, run records and any feedback tied to your
            account. You do not have to explain why. Tell me the email address you signed
            in with so I can find the right account.
          </p>
          <p>
            You can also clear everything held in your own browser at any time by clearing
            site data for this domain. That removes your local save and sign-in, but not
            anything already stored server-side &mdash; use the email above for that.
          </p>
        </Section>

        <Section title="Children">
          <p>
            This game is not aimed at children under 13 and I do not knowingly collect
            their data. If you believe a child has signed in, email me and I will remove
            the account.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If what I collect changes, this page changes and the date at the top moves. I
            will not quietly start collecting something that is not listed here.
          </p>
        </Section>

        <Link to="/" className="text-[12px] text-slate-500 hover:text-rune transition">
          &larr; Back to the game
        </Link>
      </div>
    </div>
  )
}

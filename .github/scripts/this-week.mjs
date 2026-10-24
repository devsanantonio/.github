// Rewrites the "ls this-week/" block of profile/README.md from the DEVSA
// community calendar's public feed: the next seven days, in San Antonio time.
// Run by .github/workflows/this-week.yml. Node 20+, no dependencies.
import { readFile, writeFile } from 'node:fs/promises'

const FEED = 'https://www.devsa.community/api/events/feed'
const README = new URL('../../profile/README.md', import.meta.url)
const START = '<!-- this-week:start -->', END = '<!-- this-week:end -->'
const MAX = 10

const decode = s => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e])
const tag = (item, name) => decode(item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '')
const central = (d, opts) => d.toLocaleString('en-US', { timeZone: 'America/Chicago', ...opts })

const res = await fetch(FEED)
if (!res.ok) throw new Error(`Feed answered ${res.status}`)
const now = new Date(), weekOut = new Date(now.getTime() + 7 * 864e5)
const events = (await res.text()).split('<item>').slice(1)
  .map(item => ({ title: tag(item, 'title'), start: new Date(tag(item, 'devsa:eventStart')) }))
  .filter(e => e.start >= now && e.start < weekOut)

const lines = events.slice(0, MAX).map(e =>
  `  ${central(e.start, { weekday: 'short', month: 'short', day: 'numeric' }).padEnd(12)}` +
  `${central(e.start, { hour: 'numeric', minute: '2-digit' }).padStart(8)}   ${e.title}`)
if (events.length > MAX) lines.push(`  …and ${events.length - MAX} more`)
if (!events.length) lines.push('  Nothing on the calendar in the next seven days.')

const block = [
  START,
  '```',
  'guest@devsa ~ % ls this-week/',
  '',
  ...lines,
  '```',
  '',
  `Updated daily from the [community calendar](https://www.devsa.community/events), the next seven days in Central time. ` +
  `[Build on the same feed.](https://github.com/devsanantonio/community-calendar-api)`,
  END,
].join('\n')

const readme = await readFile(README, 'utf8')
const from = readme.indexOf(START), to = readme.indexOf(END)
if (from < 0 || to < from) throw new Error('this-week markers not found in profile/README.md')
const next = readme.slice(0, from) + block + readme.slice(to + END.length)
if (next !== readme) await writeFile(README, next)
console.log(`${events.length} events in the next seven days${next === readme ? ', README unchanged' : ', README updated'}`)

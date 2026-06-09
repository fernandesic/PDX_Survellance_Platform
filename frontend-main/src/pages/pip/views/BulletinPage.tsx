import { Newspaper, ExternalLink, Calendar, Globe } from 'lucide-react'
import { SectionTitle, LoadingSpinner, ErrorAlert, Card, ExternalLinkButton } from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import { fetchBulletin } from '../utils/api'
import clsx from 'clsx'

const LANDSCAPE_URL = 'https://af-pip-landscape-survey-g0bgdjekhzewdqah.westeurope-01.azurewebsites.net/pip-landscape-survey/'
const BULLETIN_URL  = 'http://newsletters.afro.who.int/influenza-weekly-bulletin/18l7fce20p01ubbwkcwgcw?email=true&lang=en&a=11&p=66484014'

const HIR_LINKS = [
  { label: 'AFRO Health Information Repository', url: 'https://www.afro.who.int/health-topics/disease-prevention/influenza' },
  { label: 'WHO FluNet', url: 'https://www.who.int/tools/flunet' },
  { label: 'WHO FluID', url: 'https://apps.who.int/flumart/Default?ReportNo=12' },
  { label: 'PIP Landscape Survey', url: LANDSCAPE_URL },
]

export default function BulletinPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  
  const { data, loading, error, refetch } = useAsync(fetchBulletin)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={clsx("text-2xl font-bold", colors.text.primary)}>Epidemiological Bulletin</h1>
          <p className={clsx("text-sm mt-1 font-medium", colors.text.secondary)}>
            WHO AFRO Weekly Influenza Epidemiological Bulletin — latest surveillance summary
          </p>
        </div>
        <button
          onClick={refetch}
          className={clsx(
            "px-4 py-2 text-sm font-semibold border rounded-lg transition-all",
            isLight 
              ? "border-gray-200 text-gray-600 hover:border-emerald-600 hover:text-emerald-600" 
              : "border-white/10 text-gray-400 hover:border-emerald-400 hover:text-emerald-300"
          )}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && <LoadingSpinner label="Fetching latest bulletin…" />}
      {error && <ErrorAlert message={error} />}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main bulletin card */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bulletin-card">
              <div className="flex items-center gap-3 mb-4">
                <div className={clsx("p-2 rounded-lg", isLight ? "bg-emerald-50" : "bg-emerald-500/10")}>
                  <Newspaper size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h2 className={clsx("font-bold", colors.text.primary)}>{data.headline}</h2>
                  <p className={clsx("text-xs font-medium", colors.text.muted)}>{data.source}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-5">
                <div className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 px-3 py-1 rounded-full font-bold shadow-sm">
                  <Calendar size={13} /> {data.epi_week}
                </div>
                <span className={clsx("text-sm", colors.text.muted)}>Published: {data.publication_date}</span>
              </div>

              <div className="mb-5">
                <h3 className={clsx("text-sm font-semibold mb-3", colors.text.primary)}>Key Findings This Week</h3>
                <ul className="space-y-2.5">
                  {data.key_findings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className={colors.text.secondary}>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={clsx("flex gap-3 pt-4 border-t", isLight ? "border-gray-50" : "border-white/5")}>
                <ExternalLinkButton href={data.bulletin_url} variant="primary">
                  View Full Bulletin
                </ExternalLinkButton>
                <a
                  href={data.bulletin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 border text-sm font-semibold rounded-lg transition-all",
                    isLight 
                      ? "border-gray-200 text-gray-600 hover:border-emerald-600 hover:text-emerald-600" 
                      : "border-white/10 text-gray-400 hover:border-emerald-400 hover:text-emerald-300"
                  )}
                >
                  HIR Page <ExternalLink size={13} />
                </a>
              </div>
            </Card>

            {/* Landscape survey link */}
            <Card>
              <div className="flex items-start gap-4">
                <div className={clsx("p-3 rounded-lg flex-shrink-0", isLight ? "bg-emerald-50" : "bg-emerald-500/10")}>
                  <Globe size={22} className="text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className={clsx("font-semibold mb-1", colors.text.primary)}>2023–2024 PIP Landscape Survey</h3>
                  <p className={clsx("text-sm mb-3 font-medium", colors.text.secondary)}>
                    Interactive landscape survey dashboard hosted on the WHO AFRO platform.
                    Covers all 47 Member States with full questionnaire results.
                  </p>
                  <ExternalLinkButton href={LANDSCAPE_URL} variant="secondary">
                    Open Landscape Survey
                  </ExternalLinkButton>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar links */}
          <div className="space-y-4">
            <Card>
              <SectionTitle subtitle="Related platforms and repositories">
                Quick Links
              </SectionTitle>
              <div className="space-y-2">
                {HIR_LINKS.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-lg border transition-all group",
                      isLight 
                        ? "border-gray-50 hover:border-emerald-600 hover:bg-emerald-50/30" 
                        : "border-white/5 hover:border-emerald-400 hover:bg-white/5"
                    )}
                  >
                    <span className={clsx("text-sm font-medium group-hover:text-emerald-500 transition-colors", colors.text.secondary)}>
                      {link.label}
                    </span>
                    <ExternalLink size={13} className={clsx("transition-transform group-hover:scale-110", colors.text.muted)} />
                  </a>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>Bulletin Archive</SectionTitle>
              <div className="space-y-2">
                {[
                  { week: 'EW 14, 2025', date: '7 Apr 2025' },
                  { week: 'EW 13, 2025', date: '31 Mar 2025' },
                  { week: 'EW 12, 2025', date: '24 Mar 2025' },
                  { week: 'EW 11, 2025', date: '17 Mar 2025' },
                ].map(item => (
                  <a
                    key={item.week}
                    href={BULLETIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "flex items-center justify-between p-2.5 rounded-lg transition-colors group",
                      isLight ? "hover:bg-gray-50" : "hover:bg-white/5"
                    )}
                  >
                    <div>
                      <p className={clsx("text-sm font-semibold group-hover:text-emerald-500", colors.text.primary)}>{item.week}</p>
                      <p className={clsx("text-xs font-medium", colors.text.muted)}>{item.date}</p>
                    </div>
                    <ExternalLink size={12} className={clsx("opacity-30 group-hover:opacity-100 transition-opacity", colors.text.muted)} />
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

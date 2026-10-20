import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { Card, Button } from '../../common/ui'
import { useLeaderboardStore } from '../../../stores/stats/leaderboardStore'
import type { LeaderboardRegion } from '../../../types/deadlock-stats'
import { AsyncSection, HeroChip } from '../primitives'
import { rankLabelFromBadge } from '../format'

const REGIONS: { value: LeaderboardRegion; label: string }[] = [
    { value: 'NAmerica', label: 'NA' },
    { value: 'Europe', label: 'EU' },
    { value: 'Asia', label: 'Asia' },
    { value: 'SAmerica', label: 'SA' },
    { value: 'Oceania', label: 'OCE' },
]

export function LeaderboardTab() {
    const { t } = useTranslation()
    const region = useLeaderboardStore((s) => s.region)
    const leaderboard = useLeaderboardStore((s) => s.leaderboard)
    const loadLeaderboard = useLeaderboardStore((s) => s.loadLeaderboard)

    useEffect(() => {
        if (leaderboard.status === 'idle') loadLeaderboard()
    }, [leaderboard.status, loadLeaderboard])

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                {REGIONS.map((r) => (
                    <Button
                        key={r.value}
                        variant={region === r.value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => loadLeaderboard(r.value)}
                    >
                        {r.value === 'Asia' ? t('stats.leaderboard.asia') : r.label}
                    </Button>
                ))}
            </div>

            <Card title={t('stats.leaderboard.topPlayers')} icon={Trophy} description={t('stats.leaderboard.valveLeaderboardUpdatedHourly')}>
                <AsyncSection
                    state={leaderboard}
                    onRetry={() => loadLeaderboard()}
                    emptyIcon={Trophy}
                    emptyText={t('stats.leaderboard.noDataForRegion')}
                    skeletonRows={10}
                >
                    {(entries) => (
                        <div className="space-y-1">
                            {entries.slice(0, 50).map((entry) => (
                                <div
                                    key={`${entry.rank}-${entry.account_name}`}
                                    className="flex items-center justify-between gap-3 p-3 bg-bg-tertiary rounded-sm"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-9 text-right font-mono text-accent shrink-0">
                                            #{entry.rank}
                                        </span>
                                        {entry.avatar_url && (
                                            <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                                        )}
                                        <span className="font-medium truncate">
                                            {entry.persona_name ?? entry.account_name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-5 text-sm text-text-secondary shrink-0">
                                        {(entry.top_hero_ids?.length ?? 0) > 0 && (
                                            <span className="hidden md:flex items-center gap-1">
                                                {entry.top_hero_ids.slice(0, 3).map((heroId) => (
                                                    <HeroChip key={heroId} heroId={heroId} size="sm" />
                                                ))}
                                            </span>
                                        )}
                                        {/* The Valve leaderboard endpoint returns no wins or match count
                                            (see fetchLeaderboard in services/stats.ts), so those two
                                            columns never rendered and their strings were dead copy
                                            shipped to translators. Re-add with the data if the endpoint
                                            ever provides them. */}
                                        <span className="text-accent w-28 text-right">
                                            {rankLabelFromBadge(entry.badge_level)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </AsyncSection>
            </Card>
        </div>
    )
}

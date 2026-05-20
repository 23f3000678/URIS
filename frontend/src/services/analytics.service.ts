/**
 * analytics.service.ts — Phase 7 Operational Intelligence Layer
 *
 * Typed wrappers for all /analytics/* endpoints.
 */
import api from './api'

// ── Workload ──────────────────────────────────────────────────────────────────

export interface WorkloadIntern {
  internId:      string
  name:          string
  capacityScore: number
  tli:           number
  activeTasks:   number
  staleTasks:    number
  blockedTasks:  number
  overdueTasks:  number
  status:        'healthy' | 'moderate' | 'low'
  isOverloaded:  boolean
}

export interface WorkloadSummary {
  total:        number
  overloaded:   number
  lowCapacity:  number
  healthy:      number
  withBlockers: number
  withStale:    number
}

export interface WorkloadData {
  interns: WorkloadIntern[]
  summary: WorkloadSummary
}

// ── Support ───────────────────────────────────────────────────────────────────

export interface SupportBreachItem {
  id:          string
  title:       string
  priority:    string
  category:    string
  createdAt:   string
  assignedToId?: string | null
}

export interface SupportData {
  total:             number
  unassigned:        number
  byStatus:          Record<string, number>
  byPriority:        Record<string, number>
  slaBreach:         SupportBreachItem[]
  slaBreachCount:    number
  slaThresholdHours: number
}

// ── Trends ────────────────────────────────────────────────────────────────────

export interface ScoreWeek {
  week:        string
  capacity:    { avg: number; min: number; max: number }
  credibility: { avg: number; min: number; max: number }
  performance: { avg: number; min: number; max: number }
  internCount: number
}

export interface ScoreTrendsData {
  weeks:      ScoreWeek[]
  trendWeeks: number
}

export interface WorkloadWeek {
  week:                string
  totalActiveTasks:    number
  totalCompletedTasks: number
  internCount:         number
  assignmentDensity:   number
}

export interface WorkloadTrendData {
  weeks:      WorkloadWeek[]
  trendWeeks: number
}

export interface CapacityPoint {
  date:  string
  score: number
}

// ── SLA ───────────────────────────────────────────────────────────────────────

export interface StaleTask {
  id:              string
  title:           string
  internId:        string
  internName:      string
  lastUpdatedAt:   string
  deadline:        string | null
  status:          string
  daysSinceUpdate: number
}

export interface OverdueTask {
  id:          string
  title:       string
  internId:    string
  internName:  string
  deadline:    string
  status:      string
  progressPct: number
  daysOverdue: number
}

export interface BlockerTask {
  id:            string
  title:         string
  internId:      string
  internName:    string
  blockerType:   string | null
  lastUpdatedAt: string
}

export interface SupportBreach {
  id:        string
  title:     string
  priority:  string
  category:  string
  createdAt: string
  status:    string
  hoursOpen: number
}

export interface SLAData {
  staleTasks:         StaleTask[]
  overdueTasks:       OverdueTask[]
  unresolvedBlockers: BlockerTask[]
  supportBreaches:    SupportBreach[]
  counts: {
    staleTasks:         number
    overdueTasks:       number
    unresolvedBlockers: number
    supportBreaches:    number
  }
  thresholds: {
    staleDays:    number
    supportHours: number
  }
}

// ── Team Health ───────────────────────────────────────────────────────────────

export interface TeamHealthRow {
  id:               string
  name:             string
  internCount:      number
  avgCapacity:      number
  avgRpi:           number
  avgTli:           number
  overloadedCount:  number
  lowCapacityCount: number
  activeTasks:      number
  isInactive:       boolean
  isOverloaded:     boolean
  healthStatus:     'healthy' | 'moderate' | 'critical'
}

export interface TeamHealthData {
  teams: TeamHealthRow[]
  summary: {
    totalTeams:      number
    healthyTeams:    number
    criticalTeams:   number
    inactiveTeams:   number
    overloadedTeams: number
  }
}

// ── Digest ────────────────────────────────────────────────────────────────────

export interface DigestIntern {
  internId:         string
  name:             string
  credibilityScore: number
}

export interface DigestTask {
  id:              string
  title:           string
  internId:        string
  internName:      string
  progressPct:     number
  lastUpdatedAt:   string
  daysSinceUpdate: number
}

export interface DigestRequest {
  id:         string
  title:      string
  priority:   string
  category:   string
  createdAt:  string
  status:     string
  unassigned: boolean
  hoursOpen:  number
}

export interface DigestData {
  lowCredibilityInterns: DigestIntern[]
  inactiveTasks:         DigestTask[]
  overdueRequests:       DigestRequest[]
  counts: {
    lowCredibilityInterns: number
    inactiveTasks:         number
    overdueRequests:       number
  }
}

// ── Full Dashboard ────────────────────────────────────────────────────────────

export interface RiskFactor {
  factor: string
  detail: string
}

export interface TaskRisk {
  taskId:          string
  title:           string
  internId:        string
  internName:      string
  severity:        'critical' | 'high' | 'medium' | 'low'
  riskFactors:     RiskFactor[]
  suggestedAction: string
  complexity:      number
  progressPct:     number
  deadline:        string | null
  lastUpdatedAt:   string
  ownerCapacity:   number | null
}

export interface TaskRiskData {
  risks: TaskRisk[]
  counts: { critical: number; high: number; medium: number; total: number }
}

export interface AssignmentReadyIntern {
  internId:          string
  name:              string
  capacityScore:     number
  credScore:         number
  tli:               number
  activeTasks:       number
  hasBlocker:        boolean
  submittedThisWeek: boolean
  readinessScore:    number
  recommendation:    'ready' | 'available_with_caution' | 'do_not_assign' | 'low_availability'
  reasons:           string[]
}

export interface AssignmentReadinessData {
  interns: AssignmentReadyIntern[]
  summary: { ready: number; availableWithCaution: number; doNotAssign: number; noAvailability: number }
}

export interface AlertGroup {
  type:            string
  label:           string
  suggestedAction: string
  count:           number
  critical:        number
  warning:         number
  affectedInterns: number
  oldestAlert:     string
  isEscalation:    boolean
  priority:        'critical' | 'high' | 'medium'
}

export interface AlertIntelligenceData {
  groups:          AlertGroup[]
  recurringIssues: { internId: string; name: string; alertCount: number }[]
  summary:         { total: number; critical: number; warning: number; types: number }
}

export interface InternTrend {
  internId:        string
  name:            string
  recentAvg:       number
  priorAvg:        number
  delta:           number
  trend:           'declining_fast' | 'declining' | 'stable' | 'improving'
  credScore:       number | null
  updateFreq:      number | null
  deadlineAdh:     number | null
  reliabilityFlag: string | null
  sparkline:       number[]
}

export interface PerformanceTrendsData {
  trends:  InternTrend[]
  summary: { decliningFast: number; declining: number; stable: number; improving: number; lowReliability: number }
}

export interface AnalyticsDashboard {
  workload:             WorkloadData
  scoreTrends:          ScoreTrendsData
  workloadTrend:        WorkloadTrendData
  sla:                  SLAData
  teamHealth:           TeamHealthData
  digest:               DigestData
  support:              SupportData
  taskRisks:            TaskRiskData
  assignmentReadiness:  AssignmentReadinessData
  alertIntelligence:    AlertIntelligenceData
  performanceTrends:    PerformanceTrendsData
}

// ── API calls ─────────────────────────────────────────────────────────────────

function wrap<T>(promise: Promise<{ data: { success: boolean; data: T } }>): Promise<T> {
  return promise.then(r => r.data.data)
}

export const getAnalyticsDashboard  = (): Promise<AnalyticsDashboard>           => wrap(api.get('/analytics/dashboard'))
export const getWorkloadData        = (): Promise<WorkloadData>                  => wrap(api.get('/analytics/workload'))
export const getSupportData         = (): Promise<SupportData>                   => wrap(api.get('/analytics/support'))
export const getScoreTrends         = (): Promise<ScoreTrendsData>               => wrap(api.get('/analytics/trends/scores'))
export const getWorkloadTrend       = (): Promise<WorkloadTrendData>             => wrap(api.get('/analytics/trends/workload'))
export const getSLAData             = (): Promise<SLAData>                       => wrap(api.get('/analytics/sla'))
export const getTeamHealthData      = (): Promise<TeamHealthData>                => wrap(api.get('/analytics/teams'))
export const getDigestData          = (): Promise<DigestData>                    => wrap(api.get('/analytics/digest'))
export const getCapacityHistory     = (internId: string): Promise<CapacityPoint[]> =>
  wrap(api.get(`/analytics/capacity-history/${internId}`))
export const getTaskRisksData       = (): Promise<TaskRiskData>                  => wrap(api.get('/analytics/task-risks'))
export const getAssignmentReadiness = (): Promise<AssignmentReadinessData>       => wrap(api.get('/analytics/assignment-readiness'))
export const getAlertIntelligence   = (): Promise<AlertIntelligenceData>         => wrap(api.get('/analytics/alert-intelligence'))
export const getPerformanceTrends   = (): Promise<PerformanceTrendsData>         => wrap(api.get('/analytics/performance-trends'))

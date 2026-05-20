import { MetricCard } from '../../../../shared/presentation/components/metricCard';

interface HeroMetricProps {
  label: string;
  onClick?: () => void;
  value: string;
}

export function HeroMetric({ label, onClick, value }: HeroMetricProps) {
  return <MetricCard label={label} onClick={onClick} value={value} />;
}

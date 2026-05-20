import { MetricCard } from '../../../../components/common/MetricCard';

interface HeroMetricProps {
  label: string;
  onClick?: () => void;
  value: string;
}

export function HeroMetric({ label, onClick, value }: HeroMetricProps) {
  return <MetricCard label={label} onClick={onClick} value={value} />;
}

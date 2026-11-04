import {
  ArmchairIcon,
  CarIcon,
  CircleDotIcon,
  CogIcon,
  CpuIcon,
  DiscIcon,
  LightbulbIcon,
  SmartphoneIcon,
  SparklesIcon,
  WavesIcon,
  WindIcon,
  type LucideIcon,
} from 'lucide-react';
import type { PartCategory } from '@carza/shared';
import { cn } from '@/lib/utils';

const ICONS: Record<PartCategory, LucideIcon> = {
  tuning: CpuIcon,
  engine: CogIcon,
  intake_exhaust: WindIcon,
  suspension: WavesIcon,
  wheels_tires: CircleDotIcon,
  brakes: DiscIcon,
  exterior: CarIcon,
  lighting: LightbulbIcon,
  interior: ArmchairIcon,
  electronics: SmartphoneIcon,
  care: SparklesIcon,
};

/** A part or mod category's icon in a soft tile. */
export function CategoryIcon({
  category,
  className,
}: {
  category: PartCategory;
  className?: string;
}) {
  const Icon = ICONS[category];
  return (
    <span
      className={cn(
        'bg-muted text-foreground/80 grid size-10 shrink-0 place-items-center rounded-xl',
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

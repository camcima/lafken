interface IStatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

export function StatCard({ label, value, hint }: IStatCardProps) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <div className="text-[10.5px] tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className="font-mono text-[28px] leading-none tracking-tight text-neutral-900">
        {value}
      </div>
      {hint ? <div className="text-[11.5px] text-neutral-500">{hint}</div> : null}
    </div>
  );
}

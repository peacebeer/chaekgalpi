import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  // 라벨 옆에 붙이는 필수(빨강)·권장 표시
  mark?: FieldMark;
};

export type FieldMark = "required" | "recommended";

export function MarkBadge({ mark }: { mark: FieldMark }) {
  return mark === "required" ? (
    <span className="text-destructive text-xs font-semibold">필수</span>
  ) : (
    <span className="bg-highlight text-highlight-foreground rounded px-1.5 text-xs font-medium">
      권장
    </span>
  );
}

// 라벨 + 입력 칸 + 오류 문구 한 묶음
export function Field({
  name,
  label,
  error,
  hint,
  mark,
  ...props
}: FieldProps) {
  const describedBy = error
    ? `${name}-error`
    : hint
      ? `${name}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {mark && <MarkBadge mark={mark} />}
      </Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

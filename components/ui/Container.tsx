import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={classNames("mx-auto w-full max-w-[560px] px-4 md:max-w-[720px] xl:max-w-[840px]", className)}>
      {children}
    </div>
  );
}

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function Button({ className, variant = "default", ...props }: any) {
  return (
    <button
      className={twMerge(
        clsx(
          "button",
          variant === "outline" && "button-outline",
          variant === "ghost" && "button-ghost",
          className,
        ),
      )}
      {...props}
    />
  );
}

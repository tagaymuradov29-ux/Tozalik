"use client";
import { createContext, useContext, useState, useTransition } from "react";

type State = { error?: string; ok?: string } | undefined;
const Pending = createContext(false);

/** Server action bilan forma. Xatoda kiritilgan qiymatlar o'chib ketmaydi; reset — muvaffaqiyatda tozalash. */
export function ActionForm({
  action, children, className, reset,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  reset?: boolean;
}) {
  const [state, setState] = useState<State>();
  const [pending, start] = useTransition();
  return (
    <form
      className={className ?? "stack"}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const sub = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (sub?.name) fd.set(sub.name, sub.value);
        start(async () => {
          const r = await action(state, fd);
          setState(r);
          if (r?.ok && reset) form.reset();
        });
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.error && <div className="err">{state.error}</div>}
      {state?.ok && <div className="okmsg">{state.ok}</div>}
    </form>
  );
}

export function Submit({
  children, className, confirm: ask, name, value,
}: { children: React.ReactNode; className?: string; confirm?: string; name?: string; value?: string }) {
  const pending = useContext(Pending);
  return (
    <button
      className={className ?? "btn full"}
      disabled={pending}
      name={name}
      value={value}
      onClick={(e) => { if (ask && !window.confirm(ask)) e.preventDefault(); }}
    >
      {pending ? "Kuting…" : children}
    </button>
  );
}

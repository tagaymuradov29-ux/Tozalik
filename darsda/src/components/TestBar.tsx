"use client";
import { testSwitch } from "@/app/actions/test";

/** 🧪 Sinov akkauntlari uchun: kursni tanlasa — shu kursga o'tadi */
export function TestBar({ courses, current }: { courses: { id: number; title: string }[]; current: number }) {
  return (
    <form action={testSwitch} className="testbar">
      <span>🧪 Test · kurs:</span>
      <select name="course" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Kursni tanlash">
        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
    </form>
  );
}

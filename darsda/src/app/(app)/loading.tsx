/** Sahifa serverdan kelguncha darhol ko'rinadigan skelet — bosilganda ilova "qotib qolgandek" bo'lmaydi */
export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="sk" style={{ width: "46%", height: 34, marginTop: 8 }} />
      <div className="sk" style={{ width: "30%", height: 14 }} />
      <div className="card"><div className="sk" style={{ height: 96 }} /></div>
      <div className="card"><div className="sk" style={{ height: 22, width: "60%" }} /><div className="sk" style={{ height: 52 }} /></div>
      <div className="card"><div className="sk" style={{ height: 140 }} /></div>
    </main>
  );
}

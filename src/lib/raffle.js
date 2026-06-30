import { db } from './firebase.js'
import { ref, set, get, onValue, off, remove } from 'firebase/database'

const ROOT = 'raffle'

export function raffleRef() { return ref(db, ROOT) }

export async function saveRaffleConfig({ entries, forcedWinner }) {
  await set(ref(db, `${ROOT}/config`), { entries, forcedWinner: forcedWinner || '' })
}

export async function triggerDraw(winners) {
  const now = Date.now()
  await set(ref(db, `${ROOT}/draw`), {
    state: 'spinning',
    winners,
    startedAt: now,
  })
}

export async function addDrawnWinners(winners) {
  const snap = await get(ref(db, `${ROOT}/drawnWinners`))
  const existing = snap.val() ?? []
  await set(ref(db, `${ROOT}/drawnWinners`), [...existing, ...winners])
}

export async function removeDrawnWinners(winners) {
  const snap = await get(ref(db, `${ROOT}/drawnWinners`))
  const existing = snap.val() ?? []
  await set(ref(db, `${ROOT}/drawnWinners`), existing.filter(w => !winners.includes(w)))
}

export async function resetDrawnWinners() {
  await set(ref(db, `${ROOT}/drawnWinners`), [])
}

export async function setDrawIdle() {
  await set(ref(db, `${ROOT}/draw`), { state: 'idle', winners: [], startedAt: 0 })
}

export async function clearRaffle() {
  await remove(ref(db, ROOT))
}

export function subscribeRaffle(callback) {
  const r = raffleRef()
  onValue(r, snap => callback(snap.val()))
  return () => off(r)
}

import { QUESTIONS } from '../data/questions';

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// answers: { questionIndex: { nickname: 'A'|'B' } }
// myNickname: string
// players: string[]
export function calcMatchRates(answers, myNickname, players) {
  const total = QUESTIONS.length;
  const rates = {};

  players.forEach((player) => {
    if (player === myNickname) return;
    let match = 0;
    for (let i = 0; i < total; i++) {
      const mine = answers[i]?.[myNickname];
      const theirs = answers[i]?.[player];
      if (mine && theirs && mine === theirs) match++;
    }
    rates[player] = Math.round((match / total) * 100);
  });

  return rates;
}

export function findDebateTopics(answers, players) {
  const total = QUESTIONS.length;
  const debates = [];

  for (let i = 0; i < total; i++) {
    let countA = 0;
    let countB = 0;
    players.forEach((p) => {
      if (answers[i]?.[p] === 'A') countA++;
      else if (answers[i]?.[p] === 'B') countB++;
    });
    if (countA === countB && countA > 0) {
      debates.push({ questionIndex: i, countA, countB });
    }
  }

  return debates;
}

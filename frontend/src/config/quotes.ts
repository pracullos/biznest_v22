export type Quote = {
  text: string;
  author: string;
};

export const QUOTES: Quote[] = [
  {
    text: "The best way to predict the future is to create it with clarity, discipline, and the courage to keep moving when the path is uncertain. Build in public, iterate quickly, and learn from every failure along the way.",
    author: "Peter Drucker",
  },
  {
    text: "Price is what you pay, but value is what you get when the product, the service, and the trust behind it all compound over time. Invest in quality and reputation rather than chasing short-term margins.",
    author: "Warren Buffett",
  },
  {
    text: "Innovation distinguishes between a leader and a follower because it turns ordinary work into something people remember, rely on, and return to. Focus on meaningful problems and the rest follows.",
    author: "Steve Jobs",
  },
  {
    text: "Business opportunities are like buses: there is always another one coming, but the people who prepare, stay ready, and keep their standards high are the ones who get on board first. Discipline and consistent execution make the difference.",
    author: "Richard Branson",
  },
  {
    text: "If you do not build your dream with intention and consistency, someone else will hire you to help them build theirs instead. Start small, ship often, and protect your runway to sustain momentum.",
    author: "Tony Gaskins",
  },
];

export function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

export interface HelpItem {
  title: string;
  description: string;
}

export interface TabHelpContent {
  title: string;
  items: HelpItem[];
}

export const tabHelpContent: Record<string, TabHelpContent> = {
  home: {
    title: "Home",
    items: [
      {
        title: "Career Earnings",
        description: "Your all-time net from betting across all rounds",
      },
      {
        title: "Active Round",
        description: "Jump back into a round in progress",
      },
      {
        title: "Recent Rounds",
        description: "Quick access to your round history",
      },
      {
        title: "Quick Actions",
        description: "Start a new round or invite buddies",
      },
    ],
  },
  rounds: {
    title: "Rounds",
    items: [
      {
        title: "Start a New Round",
        description: "Pick a course, add players, choose your games",
      },
      {
        title: "Game Types",
        description: "Nassau, Skins, Match Play, Wolf, and more — each game is explained when you add it",
      },
      {
        title: "Live Scoring",
        description: "Enter scores hole by hole, see standings update live",
      },
      {
        title: "Settlement",
        description: "When you finish, we calculate who owes who automatically",
      },
    ],
  },
  buddies: {
    title: "Buddies",
    items: [
      {
        title: "Buddies",
        description: "Friends you play with — add them to rounds quickly",
      },
      {
        title: "Groups",
        description: "Create a group for your regular crew and start rounds with one tap",
      },
      {
        title: "Challenges",
        description: "Challenge a buddy to a match and settle the score",
      },
      {
        title: "Head-to-Head Records",
        description: "See your record against each buddy over time",
      },
    ],
  },
  courses: {
    title: "Courses",
    items: [
      {
        title: "Search Courses",
        description: "Browse thousands of courses with tee and slope data",
      },
      {
        title: "Favorites",
        description: "Save your home course and regular spots for quick access",
      },
      {
        title: "Add Custom Course",
        description: "Playing somewhere not listed? Add it yourself",
      },
    ],
  },
  profile: {
    title: "Profile",
    items: [
      {
        title: "Handicap",
        description: "Set your handicap index for fair betting with strokes",
      },
      {
        title: "Payment Methods",
        description: "Add Venmo, Zelle, Cash App, or Apple Cash for easy settlement",
      },
      {
        title: "Stats",
        description: "See your all-time stats, winning streaks, and more",
      },
      {
        title: "Subscription",
        description: "Manage your Press membership",
      },
    ],
  },
};

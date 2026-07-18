export interface DummyPost {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  repostedBy?: string;
  createdAt: string;
  text: string;
  image?: string;
  replies: number;
  reposts: number;
  likes: number;
}

export const dummyPosts: DummyPost[] = [
  {
    id: '1',
    author: {
      name: 'Prabowo Subianto',
      handle: 'prabowo.yapper.social',
      avatar: '/prabowo.jpg',
    },
    repostedBy: 'gibran',
    createdAt: '2h',
    text: 'Honored to greet everyone at the palace today. Big things coming for the nation — free lunch program rolling out to 10 million more students this quarter. 🇮🇩',
    image: '/prabowo.jpg',
    replies: 128,
    reposts: 542,
    likes: 3941,
  },
  {
    id: '2',
    author: {
      name: 'Prabowo Subianto',
      handle: 'prabowo.yapper.social',
      avatar: '/prabowo.jpg',
    },
    createdAt: '5h',
    text: 'Just finished a productive bilateral meeting in Paris. Strong partnerships build strong nations.',
    replies: 64,
    reposts: 210,
    likes: 1876,
  },
  {
    id: '3',
    author: {
      name: 'Prabowo Subianto',
      handle: 'prabowo.yapper.social',
      avatar: '/prabowo.jpg',
    },
    createdAt: '8h',
    text: 'They said it could not be done. We did it anyway. Never underestimate the will of the people. 🫡',
    image: '/prabowo.jpg',
    replies: 301,
    reposts: 998,
    likes: 7204,
  },
  {
    id: '4',
    author: {
      name: 'Prabowo Subianto',
      handle: 'prabowo.yapper.social',
      avatar: '/prabowo.jpg',
    },
    repostedBy: 'titiek',
    createdAt: '1d',
    text: 'Morning ride with my cat Bobby Kertanegara. He remains unimpressed by matters of state.',
    replies: 892,
    reposts: 2431,
    likes: 15600,
  },
  {
    id: '5',
    author: {
      name: 'Prabowo Subianto',
      handle: 'prabowo.yapper.social',
      avatar: '/prabowo.jpg',
    },
    createdAt: '2d',
    text: 'Reminder: national exams are next week. Study hard, sleep well, and make your parents proud. The future of this republic sits in your classrooms.',
    image: '/prabowo.jpg',
    replies: 156,
    reposts: 387,
    likes: 4102,
  },
];

export const trendingTopics = [
  'Fright Club',
  'Mariners',
  'B-Movie Dogs',
  'Big Brother',
  'Yash',
];

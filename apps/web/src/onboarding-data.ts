import type { WorkspaceGroup } from './workspace.js';

export const INTERESTS = [
  'Gaming',
  'Technology',
  'Music',
  'Movies & TV',
  'Art & Design',
  'Books',
  'Sports & Fitness',
  'Travel & Food',
] as const;

export interface RecommendedServer {
  group: WorkspaceGroup;
  interests: string[];
}

function server(
  id: string,
  name: string,
  description: string,
  interests: string[],
  icon: WorkspaceGroup['icon'],
): RecommendedServer {
  return {
    interests,
    group: {
      id,
      name,
      description,
      icon,
      channels: [
        {
          id: `${id}-general`,
          name: 'general',
          kind: 'text',
          conversationId: `${id}-general`,
          participantIds: [],
        },
        {
          id: `${id}-lounge`,
          name: 'Lounge',
          kind: 'voice',
          conversationId: `${id}-lounge`,
          participantIds: [],
        },
      ],
    },
  };
}

export const RECOMMENDED_SERVERS: RecommendedServer[] = [
  server('game-night', 'Game Night', 'Squads, co-op sessions, and friendly competition.', ['Gaming'], 'orbit'),
  server('makers-hub', 'Makers Hub', 'Build software, hardware, and ambitious side projects.', ['Technology', 'Art & Design'], 'chat'),
  server('listening-room', 'Listening Room', 'Share new releases, playlists, and live sessions.', ['Music'], 'orbit'),
  server('screen-club', 'Screen Club', 'Movies, series, reviews, and watch parties.', ['Movies & TV'], 'summit'),
  server('creative-corner', 'Creative Corner', 'A supportive home for artists and designers.', ['Art & Design'], 'garden'),
  server('book-nook', 'Book Nook', 'Reading lists, writing sprints, and thoughtful discussion.', ['Books'], 'garden'),
  server('active-crew', 'Active Crew', 'Training, sports, wellness, and accountability.', ['Sports & Fitness'], 'summit'),
  server('wander-table', 'Wander & Table', 'Travel plans, local gems, and favorite food.', ['Travel & Food'], 'orbit'),
];

// Shapes the API returns. Kept in one place so pages agree with each other.

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  preferences?: Record<string, unknown> | null;
  isOver18: boolean;
  isAdmin?: boolean;
  emailVerifiedAt?: string | null;
  alignment: number;
  createdAt: string;
}

export interface SpaceSummary {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  subscriberCount: number;
  isNsfw: boolean;
  isPrivate?: boolean;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  createdAt: string;
}

export interface Space extends SpaceSummary {
  rules?: string[] | null;
  sidebarContent?: string | null;
  adEnabled?: boolean;
  nsfwType?: string | null;
  moderators?: { username: string; isFounder: boolean }[];
  isSubscribed?: boolean;
  isModerator?: boolean;
  permissions?: Record<string, boolean> | null;
}

export interface Flair { id: string; text: string; textColor: string; bgColor: string }

export interface Post {
  id: string;
  title: string;
  content?: string | null;
  url?: string | null;
  postType: 'text' | 'link' | 'image' | 'video';
  voteScore: number;
  commentCount: number;
  createdAt: string;
  editedAt?: string | null;
  isEdited?: boolean;
  isNsfw: boolean;
  isPinned?: boolean;
  removed?: boolean;
  removalReason?: string | null;
  author: { username: string; avatarUrl?: string | null };
  space: { name: string; displayName: string; isNsfw?: boolean; iconUrl?: string | null };
  flair?: Flair | null;
  userVote?: number | null;
  isSaved?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  parentCommentId?: string | null;
  content: string;
  imageUrl?: string | null;
  voteScore: number;
  depthLevel: number;
  createdAt: string;
  editedAt?: string | null;
  removed?: boolean;
  removalReason?: string | null;
  author: { username: string; avatarUrl?: string | null };
  userVote?: number | null;
  isSaved?: boolean;
  replies?: Comment[];
}

export interface Pagination { page: number; limit: number; totalCount: number; totalPages: number }

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface Eligibility { ok: boolean; reasons: string[] }

export interface ElectionView {
  id: string;
  type: 'add_mod' | 'remove_mod';
  status: 'active' | 'passed' | 'failed' | 'withdrawn';
  phase: 'nomination' | 'discussion' | 'voting' | 'closed';
  candidate: string;
  nominator: string | null;
  justification: string | null;
  accepted: boolean;
  votingStartsAt: string;
  votingEndsAt: string;
  requiredApproval: number;
  requiredTurnout: number;
  subscribersAtStart: number;
  votesFor: number | null;
  votesAgainst: number | null;
  ballotsCast: number;
  myVote: 'for' | 'against' | null;
  isCandidate: boolean;
}

export interface CommunityVoteView {
  id: string;
  type: string;
  title: string;
  proposal: string;
  status: 'active' | 'passed' | 'failed';
  phase: 'discussion' | 'voting' | 'closed';
  proposer: string | null;
  payload: { rules?: string[] } | null;
  votingStartsAt: string;
  votingEndsAt: string;
  requiredApproval: number;
  requiredTurnout: number;
  subscribersAtStart: number;
  votesFor: number | null;
  votesAgainst: number | null;
  ballotsCast: number;
  result?: { approval: number; turnout: number; total: number } | null;
  myVote: 'for' | 'against' | null;
}

export interface GovernanceData {
  space: { name: string; displayName: string; subscriberCount: number; isPrivate: boolean; adEnabled: boolean };
  rules: {
    candidate: { accountAgeDays: number; minSpaceAlignment: number };
    election: { nominationDays: number; votingDays: number; approval: number; founderRemovalApproval: number; turnout: number };
    community: { discussionDays: number; votingDays: number; approval: number; turnout: number; proposerAccountAgeDays: number };
    voter: { accountAgeDays: number };
  };
  moderators: { username: string; isFounder: boolean; addedAt: string }[];
  elections: ElectionView[];
  votes: CommunityVoteView[];
  moderation: { actionsLast30Days: number; appeals: Record<string, number> };
  eligibility: { stand: Eligibility; vote: Eligibility; propose: Eligibility } | null;
}

export interface ReportGroup {
  targetType: 'post' | 'comment';
  targetId: string;
  target: { id: string; title?: string; content?: string | null; url?: string | null; removed: boolean; createdAt: string; author: { username: string } } | null;
  count: number;
  categories: string[];
  latestAt: string;
  reports: { id: string; category: string; reason: string; reporter: string; createdAt: string }[];
}

export interface AppealView {
  id: string;
  status: 'pending' | 'approved' | 'denied' | 'escalated';
  reason: string;
  createdAt: string;
  resolvedAt?: string | null;
  reviewerNotes?: string | null;
  appellant?: string;
  reviewer?: string | null;
  space?: string;
  action: { id?: string; type?: string; actionType?: string; reason: string; by?: string; at?: string; createdAt?: string };
  canReview?: boolean;
}

export interface AdminAction {
  id: string; admin: string; actionType: string; targetType: string; targetId: string; justification: string; evidence?: string | null; createdAt: string;
}

export interface CanaryStatus {
  status: 'none' | 'valid' | 'expired'; statement: string | null; validUntil: string | null; signedAt: string | null; daysLeft: number | null;
}

export interface LegalNotice {
  id: string; noticeType: string; jurisdiction: string; dateReceived: string; actionTaken: string; publicSummary?: string | null;
}

export interface ModLogEntry {
  id: string; actionType: string; reason: string; createdAt: string; reversedAt?: string | null; moderator?: string; space?: string; targetType?: string;
  mod?: { username: string };
}

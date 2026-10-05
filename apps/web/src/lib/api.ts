/**
 * API client for Voidspace backend
 */

const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * The build bakes in a localhost API address. From another address (127.0.0.1, this machine's
 * network address, a hostname) "localhost" would point at the visitor's own device, so keep the
 * API port but use the host the page was actually opened from.
 */
function resolveApiUrl(): string {
  if (typeof window === 'undefined') return CONFIGURED_API_URL;
  try {
    const url = new URL(CONFIGURED_API_URL);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = window.location.hostname;
      return url.origin;
    }
  } catch {
    // fall through to the configured value
  }
  return CONFIGURED_API_URL;
}

const API_URL = resolveApiUrl();

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on client side
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // Endpoints without an explicit response type return `any`, like the rest of this client
  // (`user: any`). Defining a response type per endpoint is the stricter long-term fix.
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  }

  // Auth endpoints
  async register(username: string, email: string, password: string) {
    const data = await this.request<{
      message: string;
      user: any;
      token: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });

    this.setToken(data.token);
    return data;
  }

  async login(username: string, password: string) {
    const data = await this.request<{
      message: string;
      user: any;
      token: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.setToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/api/auth/me');
  }

  async verifyAge() {
    return this.request('/api/auth/verify-age', {
      method: 'POST',
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // User endpoints
  async getUserProfile(username: string) {
    return this.request<{ user: any }>(`/api/users/${username}`);
  }

  async updateProfile(username: string, data: {
    avatarUrl?: string | null;
    bio?: string | null;
    preferences?: Record<string, any> | null;
  }) {
    return this.request(`/api/users/${username}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getUserPosts(username: string, page: number = 1, limit: number = 25, spaceName?: string) {
    const query = new URLSearchParams();
    query.append('page', page.toString());
    query.append('limit', limit.toString());
    if (spaceName) query.append('space', spaceName);

    return this.request(`/api/users/${username}/posts?${query.toString()}`);
  }

  async getUserComments(username: string, page: number = 1, limit: number = 25, spaceName?: string) {
    const query = new URLSearchParams();
    query.append('page', page.toString());
    query.append('limit', limit.toString());
    if (spaceName) query.append('space', spaceName);

    return this.request(`/api/users/${username}/comments?${query.toString()}`);
  }

  async getUserAlignment(username: string) {
    return this.request<{ username: string; alignment: number }>(
      `/api/users/${username}/alignment`
    );
  }

  async getUserSpaceAlignment(username: string, spaceName: string) {
    return this.request<{
      username: string;
      space: { name: string; displayName: string };
      spaceAlignment: number;
      postAlignment: number;
      commentAlignment: number;
      postCount: number;
      commentCount: number;
    }>(`/api/users/${username}/spaces/${spaceName}/alignment`);
  }

  async getSavedPosts(page: number = 1, limit: number = 25) {
    const query = new URLSearchParams();
    query.append('page', page.toString());
    query.append('limit', limit.toString());

    return this.request(`/api/users/saved/posts?${query.toString()}`);
  }

  async getSavedComments(page: number = 1, limit: number = 25) {
    const query = new URLSearchParams();
    query.append('page', page.toString());
    query.append('limit', limit.toString());

    return this.request(`/api/users/saved/comments?${query.toString()}`);
  }

  // Space endpoints
  async getSpaces(params?: { page?: number; limit?: number; search?: string; sortBy?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.sortBy) query.append('sortBy', params.sortBy);

    return this.request(`/api/spaces?${query.toString()}`);
  }

  async getSpace(name: string) {
    return this.request(`/api/spaces/${name}`);
  }

  async createSpace(data: {
    name: string;
    displayName: string;
    description?: string;
    rules?: string[];
    sidebarContent?: string;
    isNsfw?: boolean;
    nsfwType?: string;
  }) {
    return this.request('/api/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSpace(name: string, data: {
    displayName?: string;
    description?: string;
    sidebarContent?: string;
  }) {
    return this.request(`/api/spaces/${name}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async subscribeToSpace(name: string) {
    return this.request(`/api/spaces/${name}/subscribe`, {
      method: 'POST',
    });
  }

  async unsubscribeFromSpace(name: string) {
    return this.request(`/api/spaces/${name}/subscribe`, {
      method: 'DELETE',
    });
  }

  async deleteSpace(name: string) {
    return this.request(`/api/spaces/${name}`, {
      method: 'DELETE',
    });
  }

  async getSpaceRules(name: string) {
    return this.request(`/api/spaces/${name}/rules`);
  }

  async updateSpaceRules(name: string, rules: string[]) {
    return this.request(`/api/spaces/${name}/rules`, {
      method: 'PATCH',
      body: JSON.stringify({ rules }),
    });
  }

  // Flair endpoints
  async getSpaceFlairs(name: string) {
    return this.request<{ flairs: any[] }>(`/api/spaces/${name}/flairs`);
  }

  async createFlair(spaceName: string, data: { text: string; textColor: string; bgColor: string }) {
    return this.request(`/api/spaces/${spaceName}/flairs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFlair(spaceName: string, flairId: string, data: { text?: string; textColor?: string; bgColor?: string }) {
    return this.request(`/api/spaces/${spaceName}/flairs/${flairId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFlair(spaceName: string, flairId: string) {
    return this.request(`/api/spaces/${spaceName}/flairs/${flairId}`, {
      method: 'DELETE',
    });
  }

  async getSpacePosts(name: string, params?: {
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.sort) query.append('sort', params.sort);

    return this.request(`/api/spaces/${name}/posts?${query.toString()}`);
  }

  // Post endpoints
  async getPosts(params?: {
    page?: number;
    limit?: number;
    feed?: string;
    sort?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.feed) query.append('feed', params.feed);
    if (params?.sort) query.append('sort', params.sort);

    return this.request(`/api/posts?${query.toString()}`);
  }

  async getPost(id: string) {
    return this.request(`/api/posts/${id}`);
  }

  async createPost(data: {
    spaceId: string;
    title: string;
    content?: string;
    postType: string;
    url?: string;
    isNsfw?: boolean;
  }) {
    return this.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePost(id: string, data: { title?: string; content?: string }) {
    return this.request(`/api/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePost(id: string) {
    return this.request(`/api/posts/${id}`, {
      method: 'DELETE',
    });
  }

  async voteOnPost(id: string, voteValue: 1 | -1) {
    return this.request(`/api/posts/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ voteValue: voteValue.toString() }),
    });
  }

  async removePostVote(id: string) {
    return this.request(`/api/posts/${id}/vote`, {
      method: 'DELETE',
    });
  }

  async savePost(id: string) {
    return this.request(`/api/posts/${id}/save`, {
      method: 'POST',
    });
  }

  async unsavePost(id: string) {
    return this.request(`/api/posts/${id}/save`, {
      method: 'DELETE',
    });
  }

  // Comment endpoints
  async getPostComments(postId: string, sort?: string) {
    const query = sort ? `?sort=${sort}` : '';
    return this.request(`/api/comments/posts/${postId}/comments${query}`);
  }

  async getComment(id: string) {
    return this.request(`/api/comments/${id}`);
  }

  async createComment(data: {
    postId: string;
    parentCommentId?: string;
    content: string;
    imageUrl?: string;
  }) {
    return this.request('/api/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateComment(id: string, data: { content: string; imageUrl?: string | null }) {
    return this.request(`/api/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteComment(id: string) {
    return this.request(`/api/comments/${id}`, {
      method: 'DELETE',
    });
  }

  async voteOnComment(id: string, voteValue: 1 | -1) {
    return this.request(`/api/comments/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ voteValue: voteValue.toString() }),
    });
  }

  async removeCommentVote(id: string) {
    return this.request(`/api/comments/${id}/vote`, {
      method: 'DELETE',
    });
  }

  async saveComment(id: string) {
    return this.request(`/api/comments/${id}/save`, {
      method: 'POST',
    });
  }

  async unsaveComment(id: string) {
    return this.request(`/api/comments/${id}/save`, {
      method: 'DELETE',
    });
  }

  // Search endpoint
  async search(query: string, type: 'all' | 'posts' | 'spaces' | 'users' = 'all', limit: number = 10) {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('type', type);
    params.append('limit', limit.toString());

    return this.request<{
      query: string;
      posts: any[];
      spaces: any[];
      users: any[];
    }>(`/api/search?${params.toString()}`);
  }

  // Admin endpoints
  async getAdminUsers(page: number = 1, limit: number = 50, search?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);

    return this.request<{
      users: any[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
      };
    }>(`/api/admin/users?${params.toString()}`);
  }

  async getAdminUserDetails(userId: string) {
    return this.request<{
      user: any;
      bans: any[];
      recentPosts: any[];
      recentComments: any[];
    }>(`/api/admin/users/${userId}`);
  }

  async updateAdminUser(userId: string, data: { isAdmin?: boolean; banned?: boolean }) {
    return this.request<{
      message: string;
      user: any;
    }>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminStats() {
    return this.request<{
      stats: {
        totalUsers: number;
        totalPosts: number;
        totalComments: number;
        totalSpaces: number;
        bannedUsers: number;
        adminUsers: number;
        recentSignups: number;
      };
    }>('/api/admin/stats');
  }
}

export const api = new ApiClient(API_URL);

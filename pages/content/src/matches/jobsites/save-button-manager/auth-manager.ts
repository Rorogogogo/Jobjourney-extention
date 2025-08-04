// Authentication management for save button
export class AuthManager {
  private static isAuthenticated = false;

  static async checkAuthStatus(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_AUTH_STATUS',
      });

      AuthManager.isAuthenticated = response.success && response.data?.isAuthenticated;
      console.log('🔐 Auth status:', AuthManager.isAuthenticated);
      return AuthManager.isAuthenticated;
    } catch (error) {
      console.warn('Failed to check auth status:', error);
      AuthManager.isAuthenticated = false;
      return false;
    }
  }

  static getAuthStatus(): boolean {
    return AuthManager.isAuthenticated;
  }

  static setAuthStatus(status: boolean): void {
    AuthManager.isAuthenticated = status;
  }
}
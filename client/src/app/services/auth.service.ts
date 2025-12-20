import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environments';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private router: Router) {
    this.supabase = createClient(environment.SUPABASE_URL, environment.SUPABASE_ANON_KEY);

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    // Initialize with current session
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    // Handle OAuth redirect if user comes back from provider
    this.handleRedirect();
  }

  /** --- Public Methods --- **/

  // Get current user ID
  getCurrentUserId(): string | null {
    return this.currentUserSubject.value?.id ?? null;
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Sign in with Google
  async signInWithGoogle() {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    return { data, error };
  }

  // Sign out
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    this.currentUserSubject.next(null);
    return { error };
  }

  // Get Supabase client for direct use
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  /** --- Private Methods --- **/

  // Handle OAuth redirect and update current user
  private async handleRedirect() {
  try {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session) {
      this.currentUserSubject.next(session.user);
      this.router.navigate(['/']); // redirect to home
    }
  } catch (err) {
    console.error('Error handling OAuth redirect:', err);
  }
}
}
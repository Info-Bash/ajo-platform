import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleAuthDto {
  /**
   * The Google ID token obtained from the frontend
   * after the user completes the Google sign-in popup.
   * Verified server-side using Google's public keys.
   */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

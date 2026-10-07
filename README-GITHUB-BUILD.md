# Buy Anytime — GitHub build fixed

This copy is arranged so the **contents of this folder go directly into your GitHub repository**.

## Important
Do **not** upload this folder as a ZIP and expect GitHub Actions to unzip another project. The workflow is already inside `.github/workflows/build-apk.yml` and builds the Android project directly.

## GitHub steps
1. Open your `buy-anytime-android` repository.
2. Remove the old `build-apk.yml` workflow and any old workflow that contains `unzip Buy-Anytime-Android-Project.zip`.
3. Upload the contents of this project to the repository root. You should see `app`, `backend`, `admin`, `supabase`, `build.gradle`, `settings.gradle`, and `.github` at the root.
4. Commit to `main`.
5. Open **Actions → Build Buy Anytime APK → Run workflow**.
6. After it succeeds, open the run and download **Buy-Anytime-Android-Builds**.

The artifact contains:
- `app-debug.apk` — install/test on Android.
- `app-release.aab` — Play Store release bundle (still needs proper signing/configuration before production publishing).

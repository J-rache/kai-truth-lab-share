# Repository Redundancy

Repository redundancy tracks backup and public-share destinations as explicit plans instead of relying on memory.

Create a GitLab mirror plan:

```powershell
node src/cli.mjs mirror plan --id gitlab-share --host gitlab --remote gitlab --url https://gitlab.com/group/project.git --purpose "backup and second public share" --json
```

List plans:

```powershell
node src/cli.mjs mirror list --json
```

Verify a public destination:

```powershell
node src/cli.mjs mirror verify gitlab-share --json
```

For GitLab API project creation and authenticated push, use the full-access vaulted helper:

```powershell
E:\codex-persona\toolbox\gitlab-full-access\scripts\Test-GitLabFullAccess.ps1
E:\codex-persona\toolbox\gitlab-full-access\scripts\Ensure-GitLabProject.ps1 -Path project-name -Visibility private
E:\codex-persona\toolbox\gitlab-full-access\scripts\Push-GitLabRepo.ps1 -RepoPath C:\path\to\repo -ProjectUrl https://gitlab.com/namespace/project-name.git
```

For legacy-key GitLab destinations that already exist, use the external vaulted legacy helper:

```powershell
E:\codex-persona\toolbox\gitlab-legacy-mirror\scripts\Test-GitLabLegacyKey.ps1 -ProjectUrl https://gitlab.com/group/project.git
E:\codex-persona\toolbox\gitlab-legacy-mirror\scripts\Add-GitLabMirrorRemote.ps1 -RepoPath C:\path\to\repo -GitLabProjectUrl https://gitlab.com/group/project.git
E:\codex-persona\toolbox\gitlab-legacy-mirror\scripts\Push-GitLabMirror.ps1 -RepoPath C:\path\to\repo
```

Truth boundaries:

- mirror URLs must be clean HTTPS URLs ending in `.git`
- credentials are refused inside remote URLs
- API project creation requires the full-access helper and the DPAPI-vaulted `codex-full-access` token
- access is proven per destination by `git ls-remote` or push evidence

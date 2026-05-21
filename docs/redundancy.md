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

For private or legacy-key GitLab destinations, use the external vaulted helper:

```powershell
E:\codex-persona\toolbox\gitlab-legacy-mirror\scripts\Test-GitLabLegacyKey.ps1 -ProjectUrl https://gitlab.com/group/project.git
E:\codex-persona\toolbox\gitlab-legacy-mirror\scripts\Add-GitLabMirrorRemote.ps1 -RepoPath C:\path\to\repo -GitLabProjectUrl https://gitlab.com/group/project.git
E:\codex-persona\toolbox\gitlab-legacy-mirror\scripts\Push-GitLabMirror.ps1 -RepoPath C:\path\to\repo
```

Truth boundaries:

- mirror URLs must be clean HTTPS URLs ending in `.git`
- credentials are refused inside remote URLs
- API project creation is outside this lab unless a confirmed API credential is attached
- access is proven per destination by `git ls-remote` or push evidence

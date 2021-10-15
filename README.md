# Invoke-Action

A GitHub Action for running GitHub Actions.....what?  This is more of an experimental action to look at
the feasibility of handling some special scenarios, including...

## Running private actions

Actions run with `uses: foo/bar@v1` must be public.  It's possible to run a private action by checking out the repository
and running it using a local path (e.g., `uses: ./`), but this adds extra steps to a workflow and also has some limitations.
With `invoke-action`, we can run private actions in a single step:

```
uses: dhadka/invoke-action@main
with:
  action: dhadka/private-action@v1
  token: ${{ secrets.PAT }}
```

Inputs, outputs, and state will continue to work as expected.

```
uses: dhadka/invoke-action@main
with:
  action: dhadka/private-action@v1
  token: ${{ secrets.PAT }}
  arg1: value1
  arg2: value2
```

## Running with elevated permissions

Hosted Linux and MacOS runners use passwordless sudo.  So while you can use `sudo` in scripts to perform
operations requiring elevated permissions, there is no option to run an action with elevated permissions.
For example, the `actions/cache` action will fail due to insufficient permissions if you try to cache a
protected folder.  With `invoke-action`, we can run with `sudo`:

```
uses: dhadka/invoke-action@main
with:
  action: actions/cache@v2
  sudo: true
  key: ${{ runner.os }}-protected-${{ github.run_id }}
  path: /protected/path
```

## Sandbox untrusted actions

We place a lot of trust in the authors of actions.  We could conduct security audits of all actions in use, but that can
quickly become unsustainable.  Instead, can we add some level of security by running the action in a sandbox by restricting
network or file access?

```
# Completely block network access
uses: dhadka/invoke-action@main
with:
  action: dhadka/malicious-action
  network: none

# Block all writes
uses: dhadka/invoke-action@main
with:
  action: dhadka/malicious-action
  fileSystem: read-only

# Run action on an overlay file system, where changes are discarded at the end of the action
uses: dhadka/invoke-action@main
with:
  action: dhadka/malicious-action
  fileSystem: overlay

# Run action on a private file system that can not read or write to existing files
uses: dhadka/invoke-action@main
with:
  action: dhadka/malicious-action
  fileSystem: private
```

The supported options are currently limited, but the underlying tool providing the sandbox,
[Firejail](https://firejail.wordpress.com/features-3/man-firejail/), supports many additional options.

## Limitations

1. This action can and will run any `pre:` and `post:` steps defined by the action, but it does not evaluate the `pre-if:` and
   `post-if:` conditions.  The only supported condition is `success()` and will fail otherwise.  While we could read these conditional
   expressions, the runner does not have enough information to evaluate them (for example, `failure()` would require access to the current
   job status).

2. Sandboxing currently only works on Linux.

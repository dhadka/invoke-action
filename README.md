# Invoke-Action

A GitHub Action for running GitHub Actions.....what?  This is more of an experimental action to look at
the feasibility of handling some special scenarios, including...

## Running private actions

Actions run with `uses: foo/bar@v1` must be public.  It's possible to run a private action by checking out the repository
and running it using a local path (e.g., `uses: ./`), but this adds extra steps to a workflow and also has some limitations.

```
uses: dhadka/invoke-action@main
with:
  action: dhadka/print-env
  token: ${{ secrets.PAT }}
```

Inputs, outputs, and state will work as expected.

```
uses: dhadka/invoke-action@main
with:
  action: dhadka/print-env
  token: ${{ secrets.PAT }}
  args: |
    foo: bar
    hello: world
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
uses: dhadka/invoke-action@main
with:
  action: dhadka/malicious-action
  sandbox: |
    network: none
```

The supported options are currently limited, but one could imagine having a sandbox that allows access to only certain IP
addresses, restricts file system access with read-only or read-write controls, filters out environment variables, etc.

## Limitations

This action can and will run any `pre:` and `post:` steps defined by the action, but it does not evaluate the `pre-if:` and
`post-if:` conditions.  As a first step, I plan to support the standard expressions like `success()` and `always()`.
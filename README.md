# Invoke-Action

A GitHub Action for running GitHub Actions.....what?

This is an experimental action to see if and how we can handle special scenarios, including:

1. Running a private action
2. Running an action with elevated permissions (i.e., with `sudo`)
3. Running an "untrusted" action in a sandbox, where file or network access is restricted

Ideally, if any of these features are useful, they should be incorporated into the GitHub Actions runner
itself to avoid 

## Limitations / Learnings

1. If you just need to invoke a private action, a more direct option is using:

   ```
   uses: actions/checkout@v2
   with:
     repository: private/action
     token: ${{ secrets.PAT }}
     ref: main
     path: private_action
   uses: ./private_action
   with:
     arg1: value1
     arg2: value2
   ```

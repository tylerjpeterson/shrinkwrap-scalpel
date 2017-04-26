# shrinkwrap-scalpel
> avoid absorbing unwanted dependency updates when upgrading specific modules from within a shrinkwrap

I feel like this must be built into npm already, or at least exist as a package...
But after a lot of time spent looking without success, I decided to write this module.
If there's a better existing approach, please share.

***

There's often a need to update a specific module in a project that has already been shrink-wrapped.
Specifically,

- you want to minimize changes to tested / production code
- you are working on a shrink-wrapped project with an `npm-shrinkwrap.json` file
- your project has a dependency on `some-module@1.0.1`
- your project needs to update to `some-module@1.3.2`
- no other dependency should pick up patch, minor, or major updates

But if you remove the shrinkwrap to update `some-module`, you almost certainly take in numerous patches, minor updates, and possibly major updates across all dependencies, not just `some-module`.
This results in substantially different built files.
This module provides a CLI to solve for this scenario.

The module first looks up to its closest `package.json` from `cwd` and guides you through upgrading (or downgrading) one or more of your dependencies.
Once you indicate which version of each packages you're after, a bundle is built in a temp directory.
A new dependency tree for the specified modules is composed, pruned, and shrinkwrapped.
These dependencies and their trees replace the old versions in the `npm-shrinkwrap.json`, leaving all other dependency trees unchanged.
The existing shrinkwrap is backed up, and the new shrinkwrap file is written in its place.

Re-install using the new `npm-shrinkwrap.json` file. 
You will still see built file diffs, but they should be limited to the upgraded modules, leaving the diff predictable, small and succinct.
No patches, minor releases, or major releases will be absorbed from other dependencies no matter how liberal your initial dependency requirements were.


## Installation
Install globally from npm. 

```sh
$ npm i -g shrinkwrap-scalpel
```



## Usage
At any depth from within a shrinkwrapped project, run `scalp` or `scalpel`:

```text
$ scalp

    shrinkwrap
     _______ _______ _______         _____  _______
     |______ |       |_____| |      |_____] |______ |
     ______| |_____  |     | |_____ |       |______ |_____

                                                    v1.1.0
 

? Which dependency(ies) would you like to upgrade? (Press <space> to select)
❯◯ @scope/module-a@0.5.0
 ◯ @scope/module-b@1.3.1
 ◯ @scope/module-c@2.1.1
 ◯ @scope/module-d@1.3.0
 ◯ @scope/module-e@3.1.0
 ◯ @scope/module-f@1.4.1
 ◯ @scope/module-g@2.3.0
(Move up and down to reveal more choices)
```

All of your dependencies will appear. 
Select the ones you wish to upgrade by using the arrows and space bar.
Next, the module blasts out a number of async `npm view` calls to retrieve module versions.

Select the version of each you wish to install.

```text
? Which dependency(ies) would you like to upgrade? @scope/module-a@0.5.0, @scope/module-b@1.3.1
? Use which version of @scope/module-a? (currently 0.5.0) 0.4.0
? Use which version of @scope/module-b? (currently 1.3.1) (Use arrow keys)
❯ 1.2.0
  1.3.0
```

Modules are installed at the requested version in a temp dir.
Once complete, the temporary bundle is pruned, shrinkwrapped, injected into the old shrinkwrap, and written in place of the previous `npm-shrinkwrap.json` file in `cwd`.
Run your project through a test install before deleting your old shrinkwrap backup.

Your old shrinkwrap is backed up in the same directory, just in case.


#### Output a diff to `$EDITOR`
Pass scalpel `--diff` and a diff between the old shrinkwrap and the new opens in `$EDITOR` upon completion.

```text
$ scalp --diff
```


## Documentation
Class methods and members are documented adherent to JSDoc - to build documentation locally, run:

```sh
$ npm run docs && open docs/index.html
```

## Tests and coverage
Coming soon.

## Known issues
1. Does not handle situations where a dependency of an upgraded module satisfies another dependency's dependency. 
Not quite sure how best to handle (or if it's a scenario worth worrying about).

2. Uses `babel` to compile the script post-install.
This introduces some delicacy and overhead.
But since many still use Node 0.12, and binding is annoying, here we are.

3. Tests.

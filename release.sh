# /bin/bash

if [ "$1" = "--help" ]; then
    echo "Release new version of the cookies-and-emails package\n"
    echo "Usage: [VERSION] release.sh [options]\n"
    echo "Options:"
    echo "\t--help\t display help text"
    echo "VERSION - is the version number to release. If not specified, the patch version number will be incremented\n"
    echo "Examples:"
    echo "\t./release.sh\t\t\t will release a new patch version"
    echo "\t./release.sh --help\t\t will display this help text"
    echo "\tVERSION=1.0.0 ./release.sh\t will release version 1.0.0"
    exit 0
fi

release_branch='main'
release_date=$(date)
current_branch=$(git branch --show-current)
current_status=$(git status -s)
incremented_version=${VERSION:='patch'}

if [ $current_branch != $release_branch ]
then
    echo "Cannot release on current branch: $current_branch.\nDo 'git switch $release_branch' and run the script again"
    exit 0
fi

if [ -n "$current_status" ]
then
    echo "Git working directory not clean.\nCommit or stash your changes first"
    exit 0
fi

echo "Adding a new version and a tag"
version=$(npm version $incremented_version -m "release $release_date")

echo "A new version created: $version. Running npm install..."
npm i --quiet --no-audit

echo "Releasing changes to git"
git add package.json package-lock.json
git commit -m -q "release $version"
git push --tags
git push origin $release_branch

echo "Publishing to npm"
npm run registry-login
npm publish

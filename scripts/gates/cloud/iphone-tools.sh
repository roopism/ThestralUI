set -euo pipefail
export DEVELOPER_DIR=/Applications/Xcode_26.3.app/Contents/Developer
test "$(xcodebuild -version)" = "$(printf 'Xcode 26.3\nBuild version 17C529')"
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
echo "JAVA_HOME=$JAVA_HOME" >> "$GITHUB_ENV"
export GEM_HOME="$RUNNER_TEMP/qualification-gems" GEM_PATH="$RUNNER_TEMP/qualification-gems"
version=$(awk '/^COCOAPODS:/ {print $2}' tests/simulator/host/Podfile.lock)
test -n "$version"
gem install cocoapods -v "$version" --no-document
mkdir "$RUNNER_TEMP/qualification-maestro"
cd "$RUNNER_TEMP/qualification-maestro"
curl --fail --silent --show-error --location --output maestro.zip https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.4.0/maestro.zip
echo 'aea22ce67ab6718997ec990c58652ede0c2be8f10ac4799039ca3dce3390d634  maestro.zip' | shasum -a 256 -c -
unzip -q maestro.zip
chmod +x maestro/bin/maestro
test "$(maestro/bin/maestro --version | tail -1)" = '2.4.0'

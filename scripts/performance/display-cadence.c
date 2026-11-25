#include <CoreVideo/CoreVideo.h>
#include <CoreGraphics/CoreGraphics.h>
#include <mach/mach_time.h>
#include <stdatomic.h>
#include <stdio.h>
#include <unistd.h>

enum { capacity = 240 };
static double stamps[capacity];
static _Atomic int count;

static CVReturn sample(CVDisplayLinkRef link, const CVTimeStamp *now,
    const CVTimeStamp *output, CVOptionFlags in, CVOptionFlags *out, void *data) {
  int i = atomic_load(&count);
  if (i < capacity) {
    stamps[i] = (double)output->hostTime / CVGetHostClockFrequency() * 1000;
    atomic_store(&count, i+1);
  }
  return kCVReturnSuccess;
}

int main(void) {
  CGDirectDisplayID id = CGMainDisplayID();
  CGDisplayModeRef mode = CGDisplayCopyDisplayMode(id);
  CVDisplayLinkRef link = NULL;
  CVReturn created = CVDisplayLinkCreateWithCGDisplay(id,&link);
  double hz = mode ? CGDisplayModeGetRefreshRate(mode) : 0;
  printf("{\"mainDisplay\":%u,\"modeHz\":%.3f,\"displayLinkCreateStatus\":%d",id,hz,created);
  if (mode) CGDisplayModeRelease(mode);
  if (created == kCVReturnSuccess && link) {
    CVDisplayLinkSetOutputCallback(link,sample,NULL);
    CVReturn started = CVDisplayLinkStart(link);
    usleep(2200000);
    CVDisplayLinkStop(link);
    printf(",\"displayLinkStartStatus\":%d,\"displayTimeDeltasMs\":[",started);
    for (int i=1;i<atomic_load(&count);i++) printf("%s%.4f", i>1?",":"",stamps[i]-stamps[i-1]);
    printf("]");
    CVDisplayLinkRelease(link);
  }
  printf("}\n");
  return 0;
}

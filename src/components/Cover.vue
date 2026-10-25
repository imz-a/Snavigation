<template>
  <div :class="status.siteStatus !== 'normal' ? 'cover focus' : 'cover'">
    <img
      v-show="status.imgLoadStatus"
      class="background"
      alt="background"
      :src="bgUrl"
      :style="{ '--blur': set.backgroundBlur + 'px' }"
      @load="imgLoadComplete"
      @error="imgLoadError"
      @animationend="imgAnimationEnd"
    />
    <Transition name="fade">
      <div v-if="set.showBackgroundGray" class="gray" />
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { statusStore, setStore } from "@/stores";

const set = setStore();
const status = statusStore();
const bgUrl = ref(null);
const imgTimeout = ref(null);
const emit = defineEmits(["loadComplete"]);

// 壁纸随机数
// 请依据文件夹内的图片个数修改 Math.random() 后面的第一个数字
const bgRandom = Math.floor(Math.random() * 3 + 1);
// 本地壁纸：所有远程壁纸的最终兜底，保证首屏一定有图
const localBgUrl = `/background/bg${bgRandom}.jpg`;

// 壁纸候选列表：按顺序尝试，前一个加载失败自动切换下一个，最后回退到本地壁纸
const getBgCandidates = () => {
  switch (set.backgroundType) {
    case 1:
      // 必应每日一图（镜像依次兜底，原 api.dujin.org 已失效）
      return [
        "https://api.qqsuu.cn/api/dm-bing",
        "https://api.yujn.cn/api/bing.php",
        "https://api.suyanw.cn/api/bing.php",
        localBgUrl,
      ];
    case 2:
      // 随机风景（原 api.aixiaowai.cn 已失效）
      return ["https://www.loliapi.com/bg/", localBgUrl];
    case 3:
      // 随机二次元（原 api.aixiaowai.cn 已失效）
      return ["https://www.loliapi.com/acg/pc/", localBgUrl];
    case 4:
      return set.backgroundCustom ? [set.backgroundCustom, localBgUrl] : [localBgUrl];
    default:
      return [localBgUrl];
  }
};

const bgCandidates = ref([]);
const bgIndex = ref(0);
const isLocalFallback = ref(false);

// 赋值壁纸
const setBgUrl = () => {
  bgCandidates.value = getBgCandidates();
  bgIndex.value = 0;
  isLocalFallback.value = bgCandidates.value.length === 1 && bgCandidates.value[0] === localBgUrl;
  bgUrl.value = bgCandidates.value[0];
};

// 图片加载完成
const imgLoadComplete = () => {
  imgTimeout.value = setTimeout(
    () => {
      status.setImgLoadStatus(true);
    },
    Math.floor(Math.random() * (600 - 300 + 1)) + 300,
  );
};

// 图片动画完成
const imgAnimationEnd = () => {
  console.log("壁纸加载且动画完成");
  // 加载完成事件
  emit("loadComplete");
};

// 图片显示失败
const imgLoadError = () => {
  if (isLocalFallback.value) {
    // 本地壁纸也加载失败，不再重试
    console.error("本地壁纸加载失败：", bgUrl.value);
    return;
  }
  const nextIndex = bgIndex.value + 1;
  if (nextIndex < bgCandidates.value.length) {
    console.warn("壁纸加载失败，尝试备用源：", bgUrl.value);
    bgIndex.value = nextIndex;
    bgUrl.value = bgCandidates.value[nextIndex];
    isLocalFallback.value = bgUrl.value === localBgUrl;
    return;
  }
  console.error("壁纸加载失败：", bgUrl.value);
  $message.error("壁纸加载失败，已临时切换回默认");
  bgUrl.value = localBgUrl;
  isLocalFallback.value = true;
};

onMounted(() => {
  setBgUrl();
});

onBeforeUnmount(() => {
  clearTimeout(imgTimeout.value);
});
</script>

<style lang="scss" scoped>
.cover {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--body-background-color);
  &.focus {
    .background {
      filter: blur(calc(var(--blur) + 10px)) brightness(0.8);
      transform: scale(1.3);
    }
  }
  .background {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    backface-visibility: hidden;
    transform: scale(1.2);
    filter: blur(var(--blur));
    transition:
      filter 0.3s,
      transform 0.3s;
    animation: fade-blur-in 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  .gray {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-image: radial-gradient(rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.5) 100%),
      radial-gradient(rgba(0, 0, 0, 0) 33%, rgba(0, 0, 0, 0.3) 166%);
  }
}
</style>

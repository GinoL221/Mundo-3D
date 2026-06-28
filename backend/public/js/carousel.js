document.addEventListener("DOMContentLoaded", function () {
  const carousel = document.getElementById("homepage-carousel");
  if (!carousel) return;

  const container = carousel.querySelector(".carousel__container");
  const slides = carousel.querySelectorAll(".carousel__slide");
  const prevBtn = carousel.querySelector(".carousel__prev");
  const nextBtn = carousel.querySelector(".carousel__next");
  const indicators = carousel.querySelectorAll(".carousel__indicators .carousel__indicator");

  const totalSlides = slides.length;
  if (totalSlides === 0) return;

  let currentIndex = 0;
  let autoplayTimer = null;
  const INTERVAL = 4000;

  function goToSlide(index) {
    if (index < 0) {
      currentIndex = totalSlides - 1;
    } else if (index >= totalSlides) {
      currentIndex = 0;
    } else {
      currentIndex = index;
    }

    container.style.transform = "translateX(" + (-currentIndex * 100) + "%)";

    indicators.forEach(function (ind, i) {
      if (i === currentIndex) {
        ind.classList.add("active");
      } else {
        ind.classList.remove("active");
      }
    });
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(function () {
      goToSlide(currentIndex + 1);
    }, INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      goToSlide(currentIndex - 1);
      startAutoplay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      goToSlide(currentIndex + 1);
      startAutoplay();
    });
  }

  indicators.forEach(function (indicator) {
    indicator.addEventListener("click", function () {
      goToSlide(parseInt(this.dataset.slide, 10));
      startAutoplay();
    });
  });

  carousel.addEventListener("mouseenter", stopAutoplay);
  carousel.addEventListener("mouseleave", startAutoplay);

  goToSlide(0);
  startAutoplay();
});

document.getElementById("year").textContent = new Date().getFullYear();
const mobileMenu = document.getElementById("mobileMenu");
mobileMenu.addEventListener("click", () => document.querySelector(".desktop-nav").classList.toggle("open"));
document.querySelectorAll(".desktop-nav a").forEach(link => link.addEventListener("click", () => document.querySelector(".desktop-nav").classList.remove("open")));
document.querySelectorAll("[data-select]").forEach(button => {
  button.addEventListener("click", () => {
    const service = button.dataset.select;
    const select = document.getElementById("serviceInterest");
    const option = [...select.options].find(item => item.textContent.startsWith(service));
    if (option) select.value = option.value;
    document.getElementById("enquiry").scrollIntoView({behavior:"smooth"});
  });
});
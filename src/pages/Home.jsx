import { useEffect, useRef, useState } from "react";
import { ref, onValue, push } from "firebase/database";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Typewriter from "typewriter-effect";
import doctorImg from "../assets/Doctors.png";
import ambulanceImg from "../assets/ambulance.png";
import technicianImg from "../assets/technician.png";
import firstaidImg from "../assets/firstaid.png";
import hospitalImg from "../assets/hospital1.png";
import avatarImg from "../assets/avatar.png";
import { FaStar } from "react-icons/fa";
import { Link } from "react-scroll";
import AOS from "aos";
import "aos/dist/aos.css";

export default function HomePage() {
  const [reviews, setReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewRole, setReviewRole] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const servicesScrollRef = useRef(null);

  useEffect(() => {
    AOS.init({ duration: 800 });

    const reviewsRef = ref(db, "reviews");
    const unsubscribe = onValue(reviewsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setReviews(list.filter((r) => r.status === "approved"));
      }
    });

    const interval = setInterval(() => {
      const el = servicesScrollRef.current;
      if (!el) return;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft + 100 >= maxScrollLeft) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: 280, behavior: "smooth" });
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      unsubscribe();
      AOS.refresh();
    };
  }, []);

  const services = [
    {
      title: "Book an Ambulance",
      desc: "Quickly request emergency transportation services directly from your location.",
      img: ambulanceImg,
      btn: "🚑 Book Now",
      onClick: () => navigate("/book"),
    },
    {
      title: "Contact A Technician",
      desc: "Reach out to certified emergency medical technicians near your area.",
      img: technicianImg,
      btn: "📞 Contact Now",
      onClick: () => navigate("/technician-chat"),
    },
    {
      title: "First Aid Guidance",
      desc: "Learn essential first aid steps to take before professional help arrives.",
      img: firstaidImg,
      btn: "🩺 Learn More",
      onClick: () => navigate("/first-aid-tips"),
    },
    {
      title: "Locate Hospital",
      desc: "Find the closest hospital or emergency clinic near you using GPS.",
      img: hospitalImg,
      btn: "📍 Locate",
      onClick: () => navigate("/hospitals"),
    },
  ];

  return (
    <div
      id="home"
      className="bg-gradient-to-br from-blue-100 via-white to-white min-h-screen font-poppins"
    >
      {/* Navbar */}

      <header className="bg-white shadow sticky top-0 z-50 md:top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-700">EMS Connect</h1>

          {/* Desktop Nav */}
          <nav className="space-x-6 text-sm font-medium text-gray-600 hidden md:block">
            {["home", "about", "services", "reviews"].map((item) => (
              <Link
                key={item}
                to={item}
                smooth={true}
                duration={500}
                className="cursor-pointer hover:text-blue-600"
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-600 focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <nav className="flex flex-col space-y-4 py-4 px-6 text-gray-600">
              {["home", "about", "services", "reviews"].map((item) => (
                <Link
                  key={item}
                  to={item}
                  smooth={true}
                  duration={500}
                  className="cursor-pointer hover:text-blue-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="py-14 px-6 md:px-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-20">
          <div className="md:w-1/2 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 leading-tight">
              Hi, We are here to connect you to{" "}
              <span className="text-blue-600 block">
                <Typewriter
                  options={{
                    strings: [
                      "An Ambulance.",
                      "A Medical Technician.",
                      "The Nearest Hospital.",
                      "FirstAid Tips",
                    ],
                    autoStart: true,
                    loop: true,
                    deleteSpeed: 50,
                  }}
                />
              </span>
            </h1>
            <p className="text-gray-600 mb-6 text-lg">
              Emergency care is one click away. Our platform connects patients
              to fast and reliable medical support — even offline.
            </p>
            <div className="flex gap-4 justify-center md:justify-start flex-wrap">
              <button
                className="bg-blue-600 font-medium text-white px-6 py-3 rounded-md hover:bg-blue-700 transition"
                onClick={() => navigate("/book")}
              >
                🚑 Book Ambulance
              </button>
              <button
                className="bg-white border border-blue-600 text-blue-600 px-6 py-3 rounded-md hover:bg-blue-100 font-medium transition"
                onClick={() => navigate("/technician-chat")}
              >
                📞 Contact Technician
              </button>
            </div>
          </div>

          <div className="md:w-1/2">
            <img
              src={doctorImg}
              alt="Medical Professionals"
              className="w-full max-w-7xl mx-auto md:mx-0"
            />
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="py-16 bg-gray-50 px-6 md:px-12 text-center"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-blue-800 mb-4">About Us</h2>
          <p className="text-gray-600 text-sm">
            EMS Connect is built to provide emergency services in
            low-connectivity areas. Our offline-first PWA ensures patient data
            collection and rapid emergency contact—even without internet.
          </p>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 px-6 md:px-12 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">
            Our Services
          </h2>
          <div className="relative">
            <div
              ref={servicesScrollRef}
              className="flex overflow-x-auto scrollbar-hide gap-6 snap-x snap-mandatory scroll-smooth"
            >
              {services.map((card, index) => (
                <div
                  key={index}
                  className="relative w-[240px] sm:w-[280px] h-[360px] snap-center rounded-xl flex-shrink-0 overflow-hidden shadow-md group"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                    style={{ backgroundImage: `url(${card.img})` }}
                    role="img"
                    aria-label={card.title}
                  />
                  <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-6 text-blue-50">
                    <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                    <p className="text-sm font-medium mb-4">{card.desc}</p>
                    <button
                      onClick={card.onClick}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded transition w-fit"
                    >
                      {card.btn}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Scroll buttons */}
            <button
              onClick={() =>
                servicesScrollRef.current?.scrollBy({
                  left: -300,
                  behavior: "smooth",
                })
              }
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-7 bg-white shadow-md rounded-full w-10 h-10 items-center justify-center hover:bg-gray-100 z-10"
            >
              ◀
            </button>
            <button
              onClick={() =>
                servicesScrollRef.current?.scrollBy({
                  left: 300,
                  behavior: "smooth",
                })
              }
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-7 bg-white shadow-md rounded-full w-10 h-10 items-center justify-center hover:bg-gray-100 z-10"
            >
              ▶
            </button>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-16 px-6 md:px-12 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h3
            className="text-3xl font-bold text-center text-blue-800 mb-4"
            data-aos="fade-up"
          >
            What People Are Saying
          </h3>
          <p
            className="text-center text-gray-500 mb-10"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Real stories from patients, technicians, and families we’ve helped.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.length > 0 ? (
              reviews.map((review, index) => (
                <div
                  key={review.id}
                  className="bg-white rounded-lg shadow-md p-6"
                  data-aos="zoom-in"
                  data-aos-delay={index * 100}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={review.avatar || avatarImg}
                      alt={review.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        {review.name}
                      </h4>
                      <p className="text-sm text-gray-500">{review.role}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-3">“{review.message}”</p>
                  <div className="flex text-yellow-500">
                    {Array.from({ length: review.rating }, (_, i) => (
                      <FaStar key={i} aria-label="star" />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center col-span-full text-gray-400 mb-6">
                No reviews yet.
              </p>
            )}
          </div>

          {/* Leave Review Button */}
          <div className="flex justify-center mt-6" data-aos="fade-up">
            <button
              onClick={() => setShowReviewModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition"
            >
              ✍️ Leave a Review
            </button>
          </div>
        </div>
      </section>

      {/* Review Modal */}
      {showReviewModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 text-blue-700">
              Leave a Review
            </h3>
            <input
              type="text"
              placeholder="Your Name (Optional)"
              value={reviewName}
              onChange={(e) => setReviewName(e.target.value)}
              className="w-full mb-3 p-2 border border-gray-300 rounded"
            />
            <input
              type="text"
              placeholder="Your Role (Patient, Technician, )  (Optional)"
              value={reviewRole}
              onChange={(e) => setReviewRole(e.target.value)}
              className="w-full mb-3 p-2 border border-gray-300 rounded"
            />
            <textarea
              placeholder="Your Review"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full mb-3 p-2 border border-gray-300 rounded h-24 resize-none"
            />
            <div className="mb-4">
              <label className="text-sm text-gray-700">Rating:</label>
              <select
                value={reviewStars}
                onChange={(e) => setReviewStars(Number(e.target.value))}
                className="ml-2 p-1 border rounded"
              >
                {[5, 4, 3, 2, 1].map((star) => (
                  <option key={star} value={star}>
                    {star} Star{star > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-between">
              <button
                onClick={async () => {
                  if (!reviewText.trim())
                    return toast.error("Review cannot be empty");
                  toast.success("Thank you! Your review has been submitted.");
                  await push(ref(db, "reviews"), {
                    name: reviewName || "Anonymous",
                    role: reviewRole || "Patient",
                    message: reviewText.trim(),
                    rating: reviewStars,
                    timestamp: Date.now(),
                    status: "pending",
                  });
                  setShowReviewModal(false);
                  setReviewName("");
                  setReviewRole("");
                  setReviewText("");
                  setReviewStars(5);
                }}
                className="bg-blue-600 text-white px-4 font-medium py-2 rounded hover:bg-blue-700"
              >
                Submit
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-gray-300 font-medium rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        id="footer"
        className="bg-blue-900 text-white py-10 px-6 text-center"
      >
        <p>
          &copy; {new Date().getFullYear()} EMS Connect. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
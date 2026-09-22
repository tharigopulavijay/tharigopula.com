/* =========================================================================
   Indian states, union territories and their significant cities.

   Used to fill a <datalist>, which is the native control that does exactly
   what a doctor expects: a dropdown she can also type into, filtering as
   she goes, and accepting anything she types that is not on the list. No
   library, no build step, and it works on every phone browser.

   The city list is NOT exhaustive - India has thousands of towns and a
   clinic can be in any of them. It covers the places most clinics are, and
   the field stays free text so a doctor in a town that is not here can
   simply type it. A list that refuses a real address is worse than no list.

   Order within each state is by size, so the likeliest answers surface
   first while she is still typing.
   ========================================================================= */
(() => {

  const STATES = {
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool',
      'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Eluru',
      'Ongole', 'Chittoor', 'Machilipatnam', 'Srikakulam', 'Vizianagaram', 'Bhimavaram'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tezu', 'Ziro', 'Bomdila', 'Tawang'],
    'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia',
      'Tezpur', 'Bongaigaon', 'Karimganj', 'Sivasagar', 'Goalpara', 'Dhubri'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia',
      'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 'Munger', 'Chhapra',
      'Danapur', 'Saharsa', 'Hajipur', 'Sasaram', 'Motihari', 'Siwan'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon',
      'Raigarh', 'Jagdalpur', 'Ambikapur', 'Dhamtari', 'Mahasamund'],
    'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar',
      'Gandhinagar', 'Junagadh', 'Anand', 'Nadiad', 'Navsari', 'Bharuch', 'Mehsana',
      'Morbi', 'Surendranagar', 'Gandhidham', 'Vapi', 'Porbandar', 'Palanpur', 'Valsad'],
    'Haryana': ['Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak',
      'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh',
      'Jind', 'Kurukshetra', 'Rewari', 'Palwal'],
    'Himachal Pradesh': ['Shimla', 'Solan', 'Dharamshala', 'Mandi', 'Baddi', 'Palampur',
      'Kullu', 'Hamirpur', 'Una', 'Bilaspur', 'Chamba', 'Nahan', 'Manali'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar',
      'Hazaribagh', 'Giridih', 'Ramgarh', 'Phusro', 'Medininagar', 'Chaibasa'],
    'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Dharwad', 'Mangaluru', 'Belagavi',
      'Kalaburagi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru',
      'Raichur', 'Bidar', 'Hassan', 'Udupi', 'Chitradurga', 'Kolar', 'Mandya', 'Gadag'],
    'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam',
      'Alappuzha', 'Palakkad', 'Kannur', 'Kottayam', 'Malappuram', 'Pathanamthitta',
      'Idukki', 'Kasaragod', 'Thalassery', 'Guruvayur', 'Perinthalmanna', 'Changanassery'],
    'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar',
      'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Katni', 'Singrauli', 'Burhanpur',
      'Khandwa', 'Morena', 'Bhind', 'Chhindwara', 'Vidisha', 'Shivpuri'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad',
      'Navi Mumbai', 'Solapur', 'Kolhapur', 'Amravati', 'Sangli', 'Jalgaon', 'Akola',
      'Latur', 'Ahmednagar', 'Dhule', 'Nanded', 'Satara', 'Chandrapur', 'Parbhani',
      'Ratnagiri', 'Beed', 'Osmanabad', 'Wardha'],
    'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul'],
    'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Baghmara', 'Williamnagar'],
    'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Saiha'],
    'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto'],
    'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri',
      'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Angul', 'Jeypore', 'Rayagada'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali',
      'Hoshiarpur', 'Pathankot', 'Moga', 'Firozpur', 'Batala', 'Khanna', 'Barnala',
      'Sangrur', 'Kapurthala', 'Phagwara'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur',
      'Bhilwara', 'Alwar', 'Sikar', 'Pali', 'Sri Ganganagar', 'Bharatpur', 'Jhunjhunu',
      'Barmer', 'Chittorgarh', 'Nagaur', 'Hanumangarh', 'Banswara', 'Mount Abu'],
    'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo', 'Singtam'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
      'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Thanjavur', 'Dindigul',
      'Tiruppur', 'Nagercoil', 'Kanchipuram', 'Cuddalore', 'Karur', 'Hosur',
      'Namakkal', 'Sivakasi', 'Pudukkottai', 'Ooty', 'Villupuram'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam',
      'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet', 'Siddipet',
      'Miryalaguda', 'Jagtial', 'Mancherial', 'Secunderabad', 'Sangareddy'],
    'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Ambassa'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut',
      'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur',
      'Noida', 'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Ayodhya',
      'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Hapur', 'Etawah', 'Mirzapur',
      'Bulandshahr', 'Sultanpur', 'Sitapur', 'Bahraich'],
    'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur',
      'Kashipur', 'Rishikesh', 'Nainital', 'Pithoragarh', 'Almora', 'Mussoorie'],
    'West Bengal': ['Kolkata', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman',
      'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Darjeeling',
      'Krishnanagar', 'Medinipur', 'Jalpaiguri', 'Balurghat', 'Bankura', 'Purulia',
      'Cooch Behar', 'Howrah'],

    /* Union territories. Kept in the same list because a doctor picking her
       address does not care about the constitutional distinction. */
    'Andaman and Nicobar Islands': ['Port Blair', 'Diglipur', 'Mayabunder', 'Car Nicobar'],
    'Chandigarh': ['Chandigarh'],
    'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
    'Delhi': ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket', 'Janakpuri',
      'Pitampura', 'Karol Bagh', 'Lajpat Nagar', 'Vasant Kunj', 'Shahdara', 'Narela'],
    'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur',
      'Kathua', 'Sopore', 'Poonch'],
    'Ladakh': ['Leh', 'Kargil'],
    'Lakshadweep': ['Kavaratti', 'Agatti', 'Amini', 'Andrott'],
    'Puducherry': ['Puducherry', 'Karaikal', 'Yanam', 'Mahe']
  };

  const stateNames = Object.keys(STATES).sort();

  /* Every city in the country, for when no state is chosen yet. Deduplicated,
     because a few names repeat across states (Udaipur, Bilaspur). */
  const allCities = [...new Set(Object.values(STATES).flat())].sort();

  function citiesIn(state) {
    return STATES[state] ? STATES[state].slice() : allCities;
  }

  /* Fills a <datalist> from an array. Options are created rather than
     assembled as HTML, so a place name with an apostrophe cannot break the
     markup. */
  function fill(datalist, values) {
    if (!datalist) return;
    datalist.replaceChildren(...values.map(value => {
      const option = document.createElement('option');
      option.value = value;
      return option;
    }));
  }

  /* Wire a state input and a city input together: choosing a state narrows
     the city suggestions, and a city already typed that does not belong to
     the new state is cleared rather than left looking confirmed. */
  function connect(stateInput, stateList, cityInput, cityList) {
    if (!stateInput || !cityInput) return;
    fill(stateList, stateNames);
    fill(cityList, allCities);

    stateInput.addEventListener('change', () => {
      const state = stateInput.value.trim();
      fill(cityList, citiesIn(state));
      if (cityInput.value && STATES[state] && !STATES[state].includes(cityInput.value)) {
        cityInput.value = '';
      }
    });

    /* Typing a city first is just as common - somebody knows their town and
       not which list it is under. Fill the state in for them when the name
       is unambiguous. */
    cityInput.addEventListener('change', () => {
      if (stateInput.value.trim()) return;
      const city = cityInput.value.trim();
      const owners = stateNames.filter(state => STATES[state].includes(city));
      if (owners.length === 1) {
        stateInput.value = owners[0];
        fill(cityList, citiesIn(owners[0]));
      }
    });
  }

  window.IndiaLocations = { STATES, stateNames, allCities, citiesIn, fill, connect };
})();


test_that("seirdv run: default params works as expected ", {

  res <- run_seirdv()
  expect_true(inherits(res, "data.frame"))
  exp_names <- c(
    "sim", "step", "S[1]", "E[1]", "I[1]", "R[1]", "D[1]", "V[1]", "status[1]"
  )
  expect_identical(names(res), exp_names)
  expect_identical(dim(res), c(1L, 9L))
  expect_identical(unname(as.numeric(res)), as.numeric(rep(1:0, c(2, 7))))

})




test_that("seirdv run: dimensions match time and populations", {

  res <- run_seirdv(n_populations = 3, time = 10)
  expect_identical(dim(res), c(10L, 23L))

  res <- run_seirdv(n_populations = 2, time = 3)
  expect_identical(dim(res), c(3L, 16L))

})




test_that("seirdv run: multiple simulations", {

  res <- run_seirdv(n_populations = 2, time = 4, n_sims = 3)
  expect_identical(dim(res), c(12L, 16L))
  exp_names <- c(
    "sim", "step", "S[1]", "S[2]", "E[1]", "E[2]", "I[1]", "I[2]",
    "R[1]", "R[2]", "D[1]", "D[2]", "V[1]", "V[2]", "status[1]", "status[2]"
  )
  expect_identical(names(res), exp_names)
  expect_equal(res[["sim"]], rep(1:3, each = 4))
  expect_equal(res[["step"]], rep(1:4, 3))
  expect_identical(unique(unlist(res[, -(1:2)])), 0)

})



test_that("seirdv run: compartment initialisation works", {
  res <- run_seirdv(
    n_populations = 2,
    ini_S = c(10, 11),
    ini_E = c(66, 3),
    ini_I = c(3, 1),
    ini_R = c(10, 20),
    ini_D = 69,
    ini_V = c(2, 3),
    time = 3
  )

  expect_equal(
    as.numeric(res[1, c("S[1]", "S[2]")]),
    c(10, 11)
  )

  expect_equal(
    as.numeric(res[1, c("E[1]", "E[2]")]),
    c(66, 3)
  )

  expect_equal(
    as.numeric(res[1, c("I[1]", "I[2]")]),
    c(3, 1)
  )

  expect_equal(
    as.numeric(res[1, c("R[1]", "R[2]")]),
    c(10, 20)
  )

  expect_equal(
    as.numeric(res[1, c("D[1]", "D[2]")]),
    c(69, 69)
  )

  expect_equal(
    as.numeric(res[1, c("V[1]", "V[2]")]),
    c(2, 3)
  )

})




test_that("seirdv run: basic progression of the disease", {

  ## Expected result:
  ## - in patch 1, infection spreads and all are recovered
  ## - in patch 2, no infection
  res <- run_seirdv(
    time = 10,
    n_populations = 2,
    ini_S = 1000,
    ini_E = c(1, 0),
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6 # 1 day duration of infection
  )
  expect_snapshot(res)

})




test_that("seirdv run: spatial processes", {
  ## Expected result:
  ## - in patch 1, infection spreads and all are recovered
  ## - in patch 2, infection spreads due to spatial spread
  res <- run_seirdv(
    time = 10,
    n_populations = 2,
    ini_S = 1000,
    ini_E = c(1, 0),
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6,
    diffusion = 0.1# 1 day duration of infection
  )
  expect_snapshot(res)



  ## Expected result:
  ## - in patch 1, infection spreads and all are recovered
  ## - in patch 2, infection spreads due to spatial spread
  ## - in patch 3, no infection as no diffusion to this patch
  delta_mat <- diag(1, 3)
  delta_mat[1, ] <- c(0.5, 0.5, 0) # infections from 1 to 1 and 2
  res <- run_seirdv(
    time = 10,
    n_populations = 3,
    ini_S = 1000,
    ini_E = c(1, 0, 0),
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6,
    delta = delta_mat
  )
  expect_snapshot(res)

})




test_that("seirdv run: routine vaccination works", {

  ## Expected result:
  ## - in patch 1, some infections and vaccination
  ## - in patch 2, only vaccination
  res <- run_seirdv(
    time = 10,
    n_populations = 2,
    ini_S = 1000,
    ini_E = c(10, 0),
    beta = 1, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 0, # no leaving I
    vacc_coverage = 0.1, # 1% pop vacc a day
    vacc_efficacy = 1 # 100% protection
  )

  expect_true(all(diff(res[, "S[1]"]) < 0)) # all S go down in 1
  expect_true(all(diff(res[, "S[2]"]) < 0)) # all S go down in 2
  expect_true(sum(res[, "I[1]"]) > 10) # new infections in 1 beyond ini 10
  expect_equal(sum(res[, "I[2]"]), 0)
  expect_true(all(diff(res[, "V[1]"]) > 0)) # V goes up in 1
  expect_true(all(diff(res[, "V[2]"]) > 0)) # V goes up in 2
  expect_equal(sum(res[, c("R[1]", "R[2]", "D[1]", "D[2]")]), 0) # no R or D


  ## Expected result:
  ## about half of the population gets vaccinated on first time step
  res <- run_seirdv(
    time = 3,
    ini_S = 1e8,
    vacc_coverage = 0.5, # 50% pop vacc a day
    vacc_efficacy = 1 # 100% protection
  )

  vacc_ratio <- res[2, "V[1]"] / res[1, "S[1]"]
  expect_true(vacc_ratio > 0.49)
  expect_true(vacc_ratio < 0.51)


  ## Expected result:
  ## about 10% of the population gets vaccinated on first time step
  res <- run_seirdv(
    time = 3,
    ini_S = 1e8,
    vacc_coverage = 0.5, # 50% pop vacc a day
    vacc_efficacy = 0.2 # 20% protection
  )

  vacc_ratio <- res[2, "V[1]"] / res[1, "S[1]"]
  expect_true(vacc_ratio > 0.09)
  expect_true(vacc_ratio < 0.11)

})




test_that("seirdv run: mortality works", {

  ## Expected result:
  ## all get infected and die
  res <- run_seirdv(
    time = 7,
    n_populations = 1,
    ini_S = 1000,
    ini_E = 1,
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6, # 1 day duration of infection
    mu = 1 # everyone dies
  )
  expect_equal(res[7, "D[1]"], 1001)


  ## Expected result:
  ## all get infected, about 20% die
  res <- run_seirdv(
    time = 7,
    n_populations = 1,
    ini_S = 1e8,
    ini_E = 1,
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6, # 1 day duration of infection
    mu = 0.2 # 20% mortality
  )

  mortality <- res[7, "D[1]"] / res[1, "S[1]"]
  expect_true(mortality > 0.19)
  expect_true(mortality < 0.21)

})




test_that("seirdv run: response trigger works", {

  ## Expected result:
  ## - patch 1: interv kicks in at time step 3
  ## - patch 2: interv kicks in at time step 4
  ## - patch 3: no intervention
  res <- run_seirdv(
    time = 8,
    n_populations = 3,
    ini_S = 1000,
    ini_E = c(0, 1, 0),
    ini_I = c(1, 0, 0),
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6, # 1 day duration of infection
    interv_delay = 2
  )

  expect_equal(res[, "status[1]"], rep(0:1, c(2, 6)))
  expect_equal(res[, "status[2]"], rep(0:1, c(3, 5)))
  expect_equal(res[, "status[3]"], rep(0, 8))



  ## Variant with no delay
  ##
  ## Expected result:
  ## - patch 1: interv kicks in at time step 1
  ## - patch 2: interv kicks in at time step 2
  ## - patch 3: no intervention
  res <- run_seirdv(
    time = 5,
    n_populations = 3,
    ini_S = 1000,
    ini_E = c(0, 1, 0),
    ini_I = c(1, 0, 0),
    beta = 1e6, # strong infection
    sigma = 1e6, # 1 day incubation
    gamma = 1e6, # 1 day duration of infection
    interv_delay = 0 # interv on the day of the first case
  )

  expect_equal(res[, "status[1]"], rep(1, 5))
  expect_equal(res[, "status[2]"], rep(0:1, c(1, 4)))
  expect_equal(res[, "status[3]"], rep(0, 5))

})




test_that("seirdv run: response decreases transmission", {

  ## Expected result:
  ## - patch 1: new E on day 2 and 3, then response prevents any new infection
  ## - patch 2: new E on days 2-5, then response prevents any new infection
  delta_mat <- rbind(c(0.5, 0.5), c(0, 1))
  res <- run_seirdv(
    time = 20,
    n_populations = 2,
    ini_S = 1e6,
    ini_I = c(10, 0),
    beta = 11.123,
    sigma = 1e30, # 1 days incubation
    gamma = 1 / 14, # 2 weeks duration of infection
    interv_delay = 2,
    interv_efficacy = 1,
    delta = delta_mat
  )

  expect_true(all(res[2:3, "E[1]"] > 0))
  expect_equal(res[4:20, "E[1]"], rep(0, 17))
  expect_true(all(res[2:5, "E[2]"] > 0))
  expect_equal(res[6:20, "E[1]"], rep(0, 15))

})



test_that("seirdv run: reactive global vaccination works", {

  ## Expected result:
  ## - patch 1: on day 6, all S get vaccinated
  ## - patch 2: no vaccination
  res <- run_seirdv(
    time = 10,
    n_populations = 2,
    ini_S = 1e6,
    ini_I = c(10, 0),
    beta = 2.456,
    sigma = 1e30, # 1 days incubation
    gamma = 1 / 14, # 2 weeks duration of infection
    vacc_coverage = 0.1,
    vacc_efficacy = 1,
    interv_delay = 5,
    interv_vacc_coverage = 1
  )

  expect_true(all(res[1:6, "S[1]"] > 0))
  expect_true(all(res[7:10, "S[1]"] == 0))
  expect_true(all(res[, "S[2]"] > 0))


  ## Expected result:
  ## vaccination in patch 1 should be about twice that of patch 2
  res <- run_seirdv(
    time = 200,
    n_populations = 2,
    ini_S = 1e6,
    ini_I = c(10, 0),
    beta = 0,
    vacc_coverage = 0.001,
    vacc_efficacy = 0.5,
    interv_delay = 0,
    interv_vacc_coverage = 0.001
  )

  vacc_ratio <- res[-1, "V[1]"] / res[-1, "V[2]"]
  expect_true(mean(vacc_ratio) < 2.1)
  expect_true(mean(vacc_ratio) > 1.9)

})



test_that("seirdv run: reactive targeted vaccination works", {

  ## Expected result:
  ## no vaccination due to target_size of 0
  res <- run_seirdv(
    time = 10,
    n_populations = 2,
    ini_S = 1e6,
    ini_I = c(10, 0),
    beta = 2.456,
    sigma = 1e30, # 1 days incubation
    gamma = 1 / 14, # 2 weeks duration of infection
    vacc_coverage = 0, # no routine vaccination
    vacc_efficacy = 1,
    interv_delay = 3,
    interv_vacc_type = 2L,
    target_size = 0 # 30 contacts per infected case on average
  )

  expect_true(all(res[1:6, "V[1]"] == 0))
  expect_true(all(res[7:10, "V[2]"] == 0))


  ## Expected result:
  ## all populations should have about 3000 vaccinations on day 3
  res <- run_seirdv(
    time = 10,
    n_populations = 100,
    delta = diag(1, 100), # all populations are independent
    ini_S = 1e6,
    ini_I = 100,
    beta = 0, # no infectiousness
    gamma = 0, # no leaving I
    vacc_coverage = 0, # no routine vaccination
    vacc_efficacy = 1,
    interv_delay = 1,
    interv_vacc_type = 2L,
    target_size = 30 # 30 contacts per infected case on average
  )

  n_vacc <- as.numeric(res[3, grep("V", names(res))])
  expect_true(mean(n_vacc) > 2900)
  expect_true(mean(n_vacc) < 3100)


  ## Expected result:
  ## all populations should have about 3000 vaccinations on day 3
  ## variant here is that population sizes are different from one population to another
  pop_sizes <- sample(c(1e4, 1e5, 1e6, 1e7, 1e8, 1e9), size = 100, replace = TRUE)
  res <- run_seirdv(
    time = 10,
    n_populations = 100,
    delta = diag(1, 100), # all populations are independent
    ini_S = pop_sizes,
    ini_I = 100,
    beta = 0, # no infectiousness
    gamma = 0, # no leaving I
    vacc_coverage = 0, # no routine vaccination
    vacc_efficacy = 1,
    interv_delay = 1,
    interv_vacc_type = 2L,
    target_size = 30 # 30 contacts per infected case on average
  )

  n_vacc <- as.numeric(res[3, grep("V", names(res))])
  expect_true(mean(n_vacc) > 2900)
  expect_true(mean(n_vacc) < 3100)




  ## Expected result:
  ## patch 1 should have about 1000 vaccinations on day 3
  ## patch 2 should have about 2000 vaccinations on day 3
  ## patch 2 should always have about twice as many vaccinations as patch 1
  ## patch 3 should have no vaccinations
  res <- run_seirdv(
    time = 20,
    n_populations = 3,
    delta = diag(1, 3), # all populations are independent
    ini_S = 1e6,
    ini_I = c(10, 20, 0),
    beta = 0, # no infectiousness
    gamma = 0, # no leaving I
    vacc_coverage = 0, # no routine vaccination
    vacc_efficacy = 1,
    interv_delay = 1,
    interv_vacc_type = 2L,
    target_size = 100 # 20 contacts per infected case on average
  )

  expect_true(res[3, "V[1]"] > 900)
  expect_true(res[3, "V[1]"] < 1100)
  expect_true(res[3, "V[2]"] > 1900)
  expect_true(res[3, "V[2]"] < 2100)
  ratio <- res[4:20, "V[2]"] / res[4:20, "V[1]"]
  expect_true(mean(ratio) > 1.9)
  expect_true(mean(ratio) < 2.1)
  expect_equal(sum(res[, "V[3]"]), 0)

})




test_that("seirdv run: response release works", {
  ## Expected result:
  ## - patch 1: intervention on days 6-10
  ## - patch 2: no intervention
  res <- run_seirdv(
    time = 15,
    n_populations = 2,
    ini_S = 1e6,
    ini_I = c(10, 0),
    beta = 2.456,
    sigma = 1e30, # 1 days incubation
    gamma = 1e30, # 1 day duration of infection
    vacc_efficacy = 1,
    interv_delay = 5,
    interv_vacc_coverage = 1,
    interv_release = 3
  )

  expect_equal(res[, "status[1]"], rep(c(0, 1, 0), each = 5))
  expect_equal(res[, "status[2]"], rep(0, 15))

})

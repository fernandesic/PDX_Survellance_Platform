
x <- list(
  n_populations = 3,
  ini_S = 0,
  ini_E = 0,
  ini_I = 0,
  ini_R = 0,
  ini_D = 0,
  ini_V = 0,
  beta = 0,
  sigma = 0,
  gamma = 0,
  mu = 0,
  interv_vacc_type = 1L,
  vacc_coverage = 0,
  vacc_efficacy = 0,
  target_size = 0,
  diffusion = 0,
  delta = NULL,
  interv_delay = 0,
  interv_efficacy = 0,
  interv_vacc_coverage = 0,
  interv_release = 21,
  time = 1,
  model = NULL,
  n_sims = 1
)


test_that("process inputs generates correct errors", {
  y <- x
  y$n_populations <- -1
  msg <- "x\\$n_populations > 0 is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$n_populations <- 0
  msg <- "x\\$n_populations > 0 is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$n_populations <- Inf
  msg <- "is.finite\\(x\\$n_populations\\)"
  expect_error(process_inputs(y), msg)

  comps <- grep("ini", names(x))
  for (i in comps) {
    y <- x
    y[[i]] <- -123
    msg <- "all\\(x >= 0\\) is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[i]] <- Inf
    msg <- "all\\(is.finite\\(x\\)\\) is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[i]] <- c(10, 1e4)
    msg <- sprintf(
      "Initial state vector for '%s' not matching the number of populations",
      names(x)[i])
    expect_error(process_inputs(y), msg)

  }

  rates <- c("beta", "sigma", "gamma", "interv_delay", "interv_release",
             "target_size")
  for (e in rates) {
    y <- x
    y[[e]] <- -0.012
    msg <- "x >= 0 is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[e]] <- "0.012"
    msg <- "is.numeric\\(x\\) is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[e]] <- Inf
    msg <- "is.finite\\(x\\) is not TRUE"
    expect_error(process_inputs(y), msg)
  }

  proportions <- c("mu", "vacc_coverage", "vacc_efficacy", "diffusion",
                   "interv_efficacy", "interv_vacc_coverage")
  for (e in proportions) {
    y <- x
    y[[e]] <- -0.012
    msg <- "x >= 0 is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[e]] <- "0.012"
    msg <- "is.numeric\\(x\\) is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[e]] <- Inf
    msg <- "is.finite\\(x\\) is not TRUE"
    expect_error(process_inputs(y), msg)

    y <- x
    y[[e]] <- 1.2
    msg <- "x <= 1 is not TRUE"
    expect_error(process_inputs(y), msg)
  }

  y <- x
  y$delta <- "toto"
  msg <- "is.numeric\\(x\\$delta\\) is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$delta <- 1:10
  msg <- "'dims' cannot be of length 0"
  expect_error(process_inputs(y), msg)

  y <- x
  y$delta <- matrix(1:10)
  msg <- "nrow\\(x\\$delta\\) == x\\$n_populations is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$delta <- matrix(1:12, nrow = 3)
  msg <- "ncol\\(x\\$delta\\) == x\\$n_populations is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$model <- "toto il est beau"
  msg <- 'inherits\\(x\\$model, "odin_model"\\) is not TRUE'
  expect_error(process_inputs(y), msg)

  y <- x
  y$model <- 1235
  msg <- 'inherits\\(x\\$model, "odin_model"\\) is not TRUE'
  expect_error(process_inputs(y), msg)

  y <- x
  y$model <- NA
  msg <- 'inherits\\(x\\$model, "odin_model"\\) is not TRUE'
  expect_error(process_inputs(y), msg)

  y <- x
  y$n_sims <- -1
  msg <- "x >= 0 is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$n_sims <- Inf
  msg <- "is.finite\\(x\\) is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$n_sims <- 0
  msg <- "x\\$n_sims >= 1 is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$interv_vacc_type <- 0
  msg <- "`interv_vacc_type` should be either 1 \\(global\\) or 2 \\(targeted\\)"
  expect_error(process_inputs(y), msg)

  y <- x
  y$interv_vacc_type <- "toto il est beau"
  msg <- "is.numeric\\(x\\) is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$interv_vacc_type <- NULL
  msg <- "is.numeric\\(x\\) is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$interv_vacc_type <- NA
  msg <- "is.numeric\\(x\\) is not TRUE"
  expect_error(process_inputs(y), msg)

  y <- x
  y$interv_vacc_type <- NA_integer_
  msg <- "is.finite\\(x\\) is not TRUE"
  expect_error(process_inputs(y), msg)

  }
)

